/**
 * selections.js is part of Aloha Editor project http://www.alohaeditor.org
 *
 * Aloha Editor ● JavaScript Content Editing Library
 * Copyright (c) 2010-2015 Gentics Software GmbH, Vienna, Austria.
 * Contributors http://www.alohaeditor.org/docs/contributing.html
 *
 * @namespace selections
 */
define([
	'functions',
	'dom',
	'keys',
	'maps',
	'html',
	'mouse',
	'events',
	'arrays',
	'ranges',
	'carets',
	'browsers',
	'overrides',
	'animation',
	'boundaries',
	'traversing',
	'editables'
], function (
	Fn,
	Dom,
	Keys,
	Maps,
	Html,
	Mouse,
	Events,
	Arrays,
	Ranges,
	Carets,
	Browsers,
	Overrides,
	Animation,
	Boundaries,
	Traversing,
	Editables
) {
	'use strict';

	/**
	 * Hides all visible caret elements and returns all those that were hidden
	 * in this operation.
	 *
	 * @param  {Document} doc
	 * @return {Array.<Element>}
	 */
	function hideCarets(doc) {
		var carets = doc.querySelectorAll('div.aloha-caret');
		var visible = [];
		[].forEach.call(carets, function (caret) {
			if ('block' === Dom.getStyle(caret, 'display')) {
				visible.push(caret);
				Dom.setStyle(caret, 'display', 'none');
			}
		});
		return visible;
	}

	/**
	 * Unhides the given list of caret elements.
	 *
	 * @param {Array.<Element>} carets
	 */
	function unhideCarets(carets) {
		carets.forEach(function (caret) {
			Dom.setStyle(caret, 'display', 'block');
		});
	}

	/**
	 * Renders the given element at the specified boundary to represent the
	 * caret position.
	 *
	 * @param {Element}  caret
	 * @param {Boundary} boundary
	 * @memberOf selections
	 */
	function show(caret, boundary) {
		var box = Carets.box(boundary);
		Maps.extend(caret.style, {
			'top'     : box.top + 'px',
			'left'    : box.left + 'px',
			'height'  : box.height + 'px',
			'width'   : '2px',
			'display' : 'block'
		});
	}

	/**
	 * Determines how to style a caret element based on the given overrides.
	 *
	 * @private
	 * @param  {Object} overrides
	 * @return {Object} A map of style properties and their values
	 */
	function stylesFromOverrides(overrides) {
		var style = {};
		style['padding'] = overrides['bold'] ? '1.5px' : '0px';
		style[Browsers.VENDOR_PREFIX + 'transform']
				= overrides['italic'] ? 'rotate(16deg)' : '';
		style['background'] = overrides['color'] || 'black';
		return style;
	}

	/**
	 * Given the boundaries checks whether the end boundary preceeds the start
	 * boundary in document order.
	 *
	 * @private
	 * @param  {Boundary} start
	 * @param  {Boundary} end
	 * @return {boolean}
	 */
	function isReversed(start, end) {
		var sc = Boundaries.container(start);
		var ec = Boundaries.container(end);
		var so = Boundaries.offset(start);
		var eo = Boundaries.offset(end);
		return (sc === ec && so > eo) || Dom.followedBy(ec, sc);
	}

	/**
	 * Creates a range that is `stride` pixels above the given offset bounds.
	 *
	 * @private
	 * @param  {Object.<string, number>} box
	 * @param  {number}                  stride
	 * @param  {Document}                doc
	 * @return {Range}
	 */
	function up(box, stride, doc) {
		var boundary = Boundaries.fromPosition(
			box.left,
			box.top - stride,
			doc
		);
		return boundary && Boundaries.range(boundary, boundary);
	}

	/**
	 * Creates a range that is `stride` pixels below the given offset bounds.
	 *
	 * @private
	 * @param  {Object.<string, number>} box
	 * @param  {number}                  stride
	 * @return {Range}
	 */
	function down(box, stride, doc) {
		var boundary = Boundaries.fromPosition(
			box.left,
			box.top + box.height + stride,
			doc
		);
		return boundary && Boundaries.range(boundary, boundary);
	}

	/**
	 * Given two ranges (represented in boundary tuples), creates a range that
	 * is between the two.
	 *
	 * @private
	 * @param  {Array.<Boundary>} a
	 * @param  {Array.<Boundary>} b
	 * @param  {string} focus Either "start" or "end"
	 * @return {Object}
	 */
	function mergeRanges(a, b, focus) {
		var start, end;
		if ('start' === focus) {
			start = a[0];
			end = b[1];
		} else {
			start = b[0];
			end = a[1];
		}
		if (isReversed(start, end)) {
			return {
				boundaries : [end, start],
				focus      : ('start' === focus) ? 'end' : 'start'
			};
		}
		return {
			boundaries : [start, end],
			focus      : focus
		};
	}

	/**
	 * Jumps the front or end position of the given editable.
	 *
	 * @private
	 * @param  {string}           direction "up" or "down"
	 * @param  {Event}            event
	 * @param  {Array.<Boundary>} boundaries
	 * @param  {string}           focus
	 * @return {Object}
	 */
	function jump(direction, event, boundaries, focus) {
		var boundary;
		if ('up' === direction) {
			boundary = Boundaries.create(event.editable.elem, 0);
			boundary = Html.expandForward(boundary);
		} else {
			boundary = Boundaries.fromEndOfNode(event.editable.elem);
			boundary = Html.expandBackward(boundary);
		}
		var next = [boundary, boundary];
		if (!Events.hasKeyModifier(event, 'shift')) {
			return {
				boundaries : next,
				focus      : focus
			};
		}
		return mergeRanges(next, boundaries, focus);
	}

	/**
	 * Finds the closest linebreaking element from the given node.
	 *
	 * @private
	 * @param  {!Node} node
	 * @return {?Element};
	 */
	function closestLine(node) {
		return Dom.upWhile(node, Fn.complement(Html.hasLinebreakingStyle));
	}

	/**
	 * Computes the visual boundary positoin above/below the given.
	 *
	 * @private
	 * @param  {!Boundary} boundary
	 * @param  {!function} step
	 * @return {?Boundary}
	 */
	function climbStep(boundary, step) {
		var range = Boundaries.range(boundary, boundary);
		var doc = Boundaries.document(boundary);
		var box = Carets.box(boundary);
		var half = box.height / 4;
		var stride = 0;
		var next;
		do {
			stride += half;
			next = step(box, stride, doc);
		} while (next && Ranges.equals(next, range));
		return next && Boundaries.fromRangeStart(next);
	}

	/**
	 * Computes a lists of box dimensions for the a given range boundaries.
	 *
	 * @private
	 * @param  {!Boundary} start
	 * @param  {!Boundary} end
	 * @return {Array.<Object>}
	 */
	function selectionBoxes(start, end) {
		var doc = Boundaries.document(start);
		var endBox = Carets.box(end);
		var endTop = endBox.top;
		var endLeft = endBox.left;
		var box, top, left, right, width, line, atEnd;
		var leftBoundary, rightBoundary;
		var boxes = [];
		var boundary = start;
		while (boundary) {
			box = Carets.box(boundary);
			top = box.top;
			line = closestLine(Boundaries.container(boundary));
			if (!line) {
				break;
			}
			atEnd = endTop < top + box.height;
			if (atEnd) {
				if (0 === boxes.length) {
					left = box.left;
				} else {
					left = Dom.offset(line).left;
				}
				width = endLeft - left;
			} else {
				if (0 === boxes.length) {
					left = box.left;
					width = elementWidth(line) - (left - Dom.offset(line).left);
				} else {
					left = Dom.offset(line).left;
					width = elementWidth(line);
				}
			}
			leftBoundary = Boundaries.fromPosition(left, top, doc);
			rightBoundary = Boundaries.fromPosition(left + width, top, doc);
			if (!leftBoundary || !rightBoundary) {
				break;
			}
			left = Carets.box(leftBoundary).left;
			right = Carets.box(rightBoundary).left;
			boxes.push({
				top    : top,
				left   : left,
				width  : right - left,
				height : box.height
			});
			if (atEnd) {
				break;
			}
			boundary = moveDown(boundary);
		}
		return boxes;
	}

	/**
	 * Renders divs to represent the given range
	 *
	 * @private
	 * @param  {!Boundary} start
	 * @param  {!Boundary} end
	 * @return {Array.<Element>}
	 */
	function highlight(start, end) {
		var doc = Boundaries.document(start);
		Dom.query('.aloha-selection-box', doc).forEach(Dom.remove);
		return selectionBoxes(start, end).map(function (box) {
			return drawBox(box, doc);
		});
	}

	/**
	 * Calculates the width of the given element as best as possible.
	 *
	 * We need to do this because clientWidth/clientHeight sometimes return 0
	 * erroneously.
	 *
	 * The difference between clientWidth and offsetWidth is that offsetWidth
	 * includes scrollbar size, but since we will almost certainly not have
	 * scrollbar within editing elements, this should not be a problem:
	 * http://stackoverflow.com/questions/4106538/difference-between-offsetheight-and-clientheight
	 *
	 * @private
	 * @param  {!Element} elem
	 * @return {number}
	 */
	function elementWidth(elem) {
		return elem.clientWidth || elem.offsetWidth;
	}

	/**
	 * Calculates the height of the given element as best as possible.
	 *
	 * We need to do this because clientWidth/clientHeight sometimes return 0
	 * erroneously.
	 *
	 * @private
	 * @see elementWidth
	 * @param  {!Element} elem
	 * @return {number}
	 */
	function elementHeight(elem) {
		return elem.clientHeight || elem.offsetHeight;
	}

	/**
	 * Checks whether the given node is a visible linebreaking non-void element.
	 *
	 * @private
	 * @param  {!Node} node
	 * @return {boolean}
	 */
	function isVisibleBreakingContainer(node) {
		return !Html.isVoidType(node)
		    && Html.isRendered(node)
		    && Html.hasLinebreakingStyle(node);
	}

	/**
	 * Checks whether the given node is a visible non-void element.
	 *
	 * @private
	 * @param  {!Node} node
	 * @return {boolean}
	 */
	function isVisibleContainer(node) {
		return !Html.isVoidType(node) && Html.isRendered(node);
	}

	/**
	 * Finds the breaking element above/below the given boundary.
	 *
	 * @private
	 * @param  {!Boundary} boundary
	 * @param  {!function} next
	 * @param  {!function} forwards
	 * @return {?Object}
	 */
	function findBreakpoint(boundary, next, forwards) {
		var node = next(boundary);
		var breaker = isVisibleBreakingContainer(node)
		            ? node
		            : forwards(node, isVisibleBreakingContainer);
		if (!breaker) {
			return null;
		}
		var isInsideBreaker = !!Dom.upWhile(node, function (node) {
			return node !== breaker;
		});
		return {
			breaker: breaker,

			// Because if the breaking node is an ancestor of the boundary
			// container, then the breakpoint ought to be calculated from the
			// top of the breaker, otherwise we ought to calculate it from the
			// bottom
			isInsideBreaker: isInsideBreaker
		};
	}

	/**
	 * Finds the visual boundary position above the given.
	 *
	 * Cases:
	 * foo<br>
	 * ba░r
	 *
	 * <p>foo</p>ba░r
	 *
	 * <p>foo</p><p>ba░r</p>
	 *
	 * foo<ul><li>ba░r</li></ul>
	 *
	 * @private
	 * @param  {!Boundary} boundary
	 * @return {Boundary}
	 */
	function moveUp(boundary) {
		var next;
		var box = Carets.box(boundary);
		var above = paragraphAbove(boundary);
		if (above) {
			var aboveBoundary = Html.expandBackward(
				Boundaries.fromEndOfNode(above)
			);
			above = Boundaries.prevNode(aboveBoundary);
			var aboveBox = Carets.box(aboveBoundary);
			var top;
			if (Dom.isTextNode(above)) {
				top = aboveBox.top + (aboveBox.height / 2);
			} else {
				top = Dom.absoluteTop(above)
				    + elementHeight(above)
				    - (aboveBox.height / 2);
			}
			next = Boundaries.fromPosition(
				box.left,
				top,
				above.ownerDocument
			);
		}
		next = next || climbStep(boundary, up);
		return (!next || box.top === Carets.box(next).top) ? boundary : next;
	}

	/**
	 * Finds the visual boundary position below the given.
	 *
	 * @private
	 * @param  {!Boundary} boundary
	 * @return {Boundary}
	 */
	function moveDown(boundary) {
		var next;
		var box = Carets.box(boundary);
		var below = paragraphBelow(boundary);
		if (below) {
			var belowBoundary = Html.expandForward(
				Boundaries.fromStartOfNode(below)
			);
			below = Boundaries.nodeAfter(belowBoundary);
			var belowBox = Carets.box(belowBoundary);
			var top = Dom.isTextNode(below)
					? belowBox.top
					: Dom.absoluteTop(below);
			top += belowBox.height / 2;
			next = Boundaries.fromPosition(
				box.left,
				top,
				below.ownerDocument
			);
		}
		next = next || climbStep(boundary, down);
		return (!next || box.top === Carets.box(next).top) ? boundary : next;
	}

	/**
	 * Locates the next paragraphing element that is visually above the given
	 * aboundary.
	 *
	 * If a soft break is causing there to be a line of text inside before a
	 * visual paragraph-dictated linebreak, then `null` is returned.
	 *
	 * @private
	 * @param  {!Boundary} boundary
	 * @return {?Boundary}
	 */
	function paragraphAbove(boundary) {
		var breakpoint = findBreakpoint(
			boundary,
			Boundaries.prevNode,
			Dom.backwardPreorderBacktraceUntil
		);
		if (!breakpoint) {
			return null;
		}
		var box = Carets.box(boundary);
		var breaker = breakpoint.breaker;
		var offset = box.top - box.height;
		var breakOffset = Dom.absoluteTop(breaker);
		if (!breakpoint.isInsideBreaker) {
			breakOffset += elementHeight(breaker);
		}
		if (offset >= breakOffset) {
			return null;
		}
		var above;
		if (breakpoint.isInsideBreaker) {
			above = Dom.nextNonAncestor(
				breaker,
				true,
				isVisibleContainer,
				Dom.isEditingHost
			);
		} else {
			above = breaker;
		}
		if (!above) {
			return null;
		}
		if (Html.isGroupContainer(above)) {
			return Dom.backwardPreorderBacktraceUntil(
				above.nextSibling,
				Html.isGroupedElement
			);
		}
		return above;
	}

	/**
	 * Locates the next paragraphing element that is visually below the given
	 * aboundary.
	 *
	 * If a soft break is causing there to be a line of text inside before a
	 * visual paragraph-dictated linebreak, then `null` is returned.
	 *
	 * @private
	 * @param  {!Boundary} boundary
	 * @return {?Boundary}
	 */
	function paragraphBelow(boundary) {
		var breakpoint = findBreakpoint(
			boundary,
			Boundaries.nextNode,
			Dom.forwardPreorderBacktraceUntil
		);
		if (!breakpoint) {
			return null;
		}
		var breaker = breakpoint.breaker;
		var box = Carets.box(boundary);
		var offset = box.top + box.height + box.height;
		var breakOffset = Dom.absoluteTop(breaker);
		if (breakpoint.isInsideBreaker) {
			breakOffset += elementHeight(breaker);
		}
		if (offset <= breakOffset) {
			return null;
		}
		var below;
		if (breakpoint.isInsideBreaker) {
			below = Dom.nextNonAncestor(
				breaker,
				false,
				isVisibleContainer,
				Dom.isEditingHost
			);
		} else {
			below = breaker;
		}
		if (!below) {
			return null;
		}
		if (Html.isGroupContainer(below)) {
			return Dom.forwardPreorderBacktraceUntil(
				below.previousSibling,
				Html.isGroupedElement
			);
		}
		return below;
	}

	/**
	 * Ensures that there is enough space above/below the given boundary from
	 * which to calculate the next boundary position for moveUp/moveDown.
	 *
	 * @private
	 * @param  {!Boundary} boundary
	 * @param  {string}    direction
	 */
	function ensureVerticalMovingRoom(boundary, direction) {
		var doc = Boundaries.document(boundary);
		var win = Dom.documentWindow(doc);
		var top = Dom.scrollTop(doc);
		var height = win.innerHeight;
		var box = Carets.box(boundary);

		var above = paragraphAbove(boundary);
		var below = paragraphBelow(boundary);

		var belowCaret = (below && !Dom.isTextNode(below))
		               ? Dom.absoluteTop(below) + box.height
		               : box.top + box.height + box.height;

		var aboveCaret = (above && !Dom.isTextNode(above))
		               ? Dom.absoluteTop(above) + elementHeight(above) - box.height
		               : box.top - box.height;

		var buffer = box.height;
		var correctTop = 0;
		if (aboveCaret <= top) {
			if ('up' === direction) {
				correctTop = aboveCaret - buffer;
			}
		} else if (belowCaret >= top + height) {
			if ('down' === direction) {
				correctTop = belowCaret - height + buffer + buffer;
			}
		}
		if (correctTop) {
			win.scrollTo(Dom.scrollLeft(doc), correctTop);
		}
	}

	/**
	 * Determines the closest visual caret position above or below the given
	 * range.
	 *
	 * @private
	 * @param  {string}           direction "up" or "down"
	 * @param  {Event}            event
	 * @param  {Array.<Boundary>} boundary
	 * @param  {string}           focus
	 * @return {Object}
	 */
	function climb(direction, event, boundaries, focus) {
		var boundary = boundaries['start' === focus ? 0 : 1];
		ensureVerticalMovingRoom(boundary, direction);
		var next = 'up' === direction ? moveUp(boundary) : moveDown(boundary);
		if (!next) {
			return {
				boundaries : boundaries,
				focus      : focus
			};
		}
		if (Events.hasKeyModifier(event, 'shift')) {
			return mergeRanges([next, next], boundaries, focus);
		}
		return {
			boundaries : [next, next],
			focus      : focus
		};
	}

	/**
	 * Determines the next visual caret position before or after the given
	 * boundaries.
	 *
	 * @private
	 * @param  {string}           direction "left" or "right"
	 * @param  {Event}            event
	 * @param  {Array.<Boundary>} boundaries
	 * @param  {string}           focus
	 * @return {Object}
	 */
	function step(direction, event, boundaries, focus) {
		var shift = Events.hasKeyModifier(event, 'shift');
		var start = boundaries[0];
		var end = boundaries[1];
		var collapsed = Boundaries.equals(start, end);
		if (collapsed || !shift) {
			focus = ('left' === direction) ? 'start' : 'end';
		}
		var boundary = ('start' === focus)
		             ? start
		             : Traversing.envelopeInvisibleCharacters(end);
		if (collapsed || shift) {
			var stride = (Events.hasKeyModifier(event, 'ctrl')
			          || Events.hasKeyModifier(event, 'alt'))
			           ? 'word'
			           : 'visual';
			var next = ('left' === direction)
			         ? Traversing.prev(boundary, stride)
			         : Traversing.next(boundary, stride);
			if (Dom.isEditingHost(Boundaries.container(next))) {
				if (Boundaries.isAtStart(boundary)) {
					next = Html.expandForward(boundary);
				} else if (Boundaries.isAtEnd(boundary)) {
					next = Html.expandBackward(boundary);
				}
			}
			if (next) {
				boundary = next;
			}
		}
		if (shift) {
			return {
				boundaries : ('start' === focus) ? [boundary, end] : [start, boundary],
				focus      : focus
			};
		}
		return {
			boundaries : [boundary, boundary],
			focus      : focus
		};
	}

	/**
	 * Determines the dimensions of the vertical line in the editable at the
	 * given boundary position.
	 *
	 * @private
	 * @param  {Boundary} boundary
	 * @param  {Element}  editable
	 * @return {Object.<string, number>}
	 */
	function lineBox(boundary, editable) {
		var box = Carets.box(boundary);
		var node = Boundaries.container(boundary);
		if (Dom.isTextNode(node)) {
			node = node.parentNode;
		}
		var fontSize = parseInt(Dom.getComputedStyle(node, 'font-size'));
		var top = box ? box.top : Dom.absoluteTop(node);
		top += (fontSize ? fontSize / 2 : 0);
		var left = Dom.offset(editable).left;
		return {
			top   : top,
			left  : left,
			right : left + elementWidth(editable)
		};
	}

	function end(event, boundaries, focus) {
		var box = lineBox(boundaries[1], event.editable.elem);
		var boundary = Boundaries.fromPosition(
			// Because -1 ensures that the position is within the viewport
			box.right - 1,
			box.top,
			Boundaries.document(boundaries[0])
		);
		if (boundary) {
			var start = boundaries['start' === focus ? 1 : 0];
			boundaries = Events.hasKeyModifier(event, 'shift')
			           ? [start, boundary]
			           : [boundary, boundary];
			focus = 'end';
		}
		return {
			boundaries : boundaries,
			focus      : focus
		};
	}

	function home(event, boundaries, focus) {
		var box = lineBox(boundaries[0], event.editable.elem);
		var boundary = Boundaries.fromPosition(
			box.left,
			box.top,
			Boundaries.document(boundaries[0])
		);
		if (boundary) {
			var end = boundaries['end' === focus ? 0 : 1];
			boundaries = Events.hasKeyModifier(event, 'shift')
			           ? [boundary, end]
			           : [boundary, boundary];
			focus = 'start';
		}
		return {
			boundaries : boundaries,
			focus      : focus
		};
	}

	/**
	 * Caret movement operations mapped against cursor key keycodes.
	 *
	 * @private
	 * @type {Object.<string, function(Event, Array.<Boundary>, string):Object>}
	 */
	var movements = {};

	movements['left'] =
	movements['*+left'] = Fn.partial(step, 'left');

	movements['right'] =
	movements['*+right'] = Fn.partial(step, 'right');

	movements['up'] =
	movements['*+up'] = Fn.partial(climb, 'up');

	movements['down'] =
	movements['*+down'] = Fn.partial(climb, 'down');

	movements['pageUp'] =
	movements['meta+up'] = Fn.partial(jump, 'up');

	movements['pageDown'] =
	movements['meta+down'] = Fn.partial(jump, 'down');

	movements['home'] =
	movements['meta+left'] =
	movements['meta+shift+left'] = home;

	movements['end'] =
	movements['meta+right'] =
	movements['meta+shift+right'] = end;

	/**
	 * Processes a keydown event.
	 *
	 * @private
	 * @param  {AlohaEvent}       event
	 * @param  {Array.<Boundary>} boundaries
	 * @param  {string}           focus
	 * @return {Object}
	 */
	function keydown(event, boundaries, focus) {
		var handler = Keys.shortcutHandler(event.meta, event.keycode, movements);
		if (handler) {
			Events.preventDefault(event.nativeEvent);
			return handler(event, boundaries, focus);
		}
		return {
			boundaries : boundaries,
			focus      : focus
		};
	}

	/**
	 * Processes a double-click event.
	 *
	 * @private
	 * @param  {Event}            event
	 * @param  {Array.<Boundary>} boundaries
	 * @return {Object}
	 */
	function dblclick(event, boundaries) {
		return {
			boundaries : Traversing.expand(boundaries[0], boundaries[1], 'word'),
			focus      : 'end'
		};
	}

	/**
	 * Processes a triple-click event.
	 *
	 * @private
	 * @param  {Event}            event
	 * @param  {Array.<Boundary>} boundaries
	 * @return {Object}
	 */
	function tplclick(event, boundaries) {
		return {
			boundaries : Traversing.expand(boundaries[0], boundaries[1], 'block'),
			focus      : 'end'
		};
	}

	/**
	 * Processes a mouseup event.
	 *
	 * @private
	 * @param  {Event}            event
	 * @param  {Array.<Boundary>} boundaries
	 * @param  {string}           focus
	 * @return {Object}
	 */
	function mouseup(event, boundaries, focus, previous, expanding) {
		return mergeRanges(boundaries, previous, focus);
	}

	/**
	 * Processes a mousedown event.
	 *
	 * @private
	 * @param  {Event}            event
	 * @param  {Array.<Boundary>} boundaries
	 * @param  {string}           focus
	 * @param  {Array.<Boundary>} previous
	 * @param  {boolean}          expanding
	 * @return {Object}
	 */
	function mousedown(event, boundaries, focus, previous, expanding) {
		if (!expanding) {
			return {
				boundaries : boundaries,
				focus      : focus
			};
		}
		var start = boundaries[0];
		var end = previous['start' === focus ? 1 : 0];
		if (isReversed(start, end)) {
			return {
				boundaries : [end, start],
				focus      : 'end'
			};
		}
		return {
			boundaries : [start, end],
			focus      : 'start'
		};
	}

	function dragndrop(event, boundaries) {
		return {
			boundaries : boundaries,
			focus      : 'end'
		};
	}

	function resize(event, boundaries, focus) {
		return {
			boundaries : boundaries,
			focus      : focus
		};
	}

	function paste(event, boundaries) {
		return {
			boundaries : boundaries,
			focus      : 'end'
		};
	}

	/**
	 * Event handlers.
	 *
	 * @private
	 * @type {Object.<string, function>}
	 */
	var handlers = {
		'keydown'        : keydown,
		'aloha.dblclick' : dblclick,
		'aloha.tplclick' : tplclick,
		'aloha.mouseup'  : mouseup,
		'mouseup'        : mouseup,
		'mousedown'      : mousedown,
		'dragover'       : dragndrop,
		'drop'           : dragndrop,
		'resize'         : resize,
		'paste'          : paste
	};

	/**
	 * Initialize blinking using the given element.
	 *
	 * @private
	 * @param  {Element} caret
	 * @return {Object}
	 */
	function blinking(caret) {
		var timers = [];
		var isBlinking = true;
		function fade(start, end, duration) {
			Animation.animate(
				start,
				end,
				Animation.easeLinear,
				duration,
				function (value, percent, state) {
					if (!isBlinking) {
						return true;
					}
					Dom.setStyle(caret, 'opacity', value);
					if (percent < 1) {
						return;
					}
					if (0 === value) {
						timers.push(setTimeout(function () {
							fade(0, 1, 100);
						}, 300));
					} else if (1 === value){
						timers.push(setTimeout(function () {
							fade(1, 0, 100);
						}, 500));
					}
				}
			);
		}
		function stop() {
			isBlinking = false;
			Dom.setStyle(caret, 'opacity', 1);
			timers.forEach(clearTimeout);
			timers = [];
		}
		function blink() {
			stop();
			isBlinking = true;
			timers.push(setTimeout(function () {
				fade(1, 0, 100);
			}, 500));
		}
		function start() {
			stop();
			timers.push(setTimeout(blink, 50));
		}
		return {
			start : start,
			stop  : stop
		};
	}

	/**
	 * Creates a new selection context.
	 *
	 * Will create a DOM element at the end of the document body to be used to
	 * represent the caret position.
	 *
	 * @param  {Document} doc
	 * @return {Object}
	 * @memberOf selections
	 */
	function Context(doc) {
		var hidden = doc.createElement('textarea');
		Maps.extend(hidden.style, {
			'overflow'  : 'hidden',
			'width'     : '1px',
			'height'    : '1px',
			'outline'   : '0',
			'opacity'   : '0.01'
		});
		var caret = doc.createElement('div');
		Maps.extend(caret.style, {
			'overflow' : 'hidden',
			'cursor'   : 'text',
			'color'    : '#000',
			'zIndex'   : '9999',
			'display'  : 'none',
			'position' : 'absolute'
		});
		Dom.addClass(caret, 'aloha-caret', 'aloha-ephemera');
		Dom.append(hidden, caret);
		Dom.append(caret, doc.body);
		return {
			blinking       : blinking(caret),
			focus          : 'end',
			boundaries     : null,
			event          : null,
			dragging       : null,
			multiclick     : null,
			clickTimer     : 0,
			lastMouseEvent : '',
			caret          : caret,
			formatting     : [],
			overrides      : []
		};
	}

	/**
	 * Ensures that the given boundary is visible inside of the viewport by
	 * scolling the view port if necessary.
	 *
	 * @param {!Boundary} boundary
	 * @memberOf selections
	 */
	function focus(boundary) {
		var box = Carets.box(boundary);
		var doc = Boundaries.document(boundary);
		var win = Dom.documentWindow(doc);
		var top = Dom.scrollTop(doc);
		var left = Dom.scrollLeft(doc);
		var height = win.innerHeight;
		var width = win.innerWidth;
		var buffer = box.height;
		var caretTop = box.top;
		var caretLeft = box.left;
		var correctTop = 0;
		var correctLeft = 0;
		if (caretTop < top) {
			// Because we want to caret to be near the top
			correctTop = caretTop - buffer;
		} else if (caretTop > top + height) {
			// Because we want to caret to be near the bottom
			correctTop = caretTop - height + buffer + buffer;
		}
		if (caretLeft < left) {
			// Because we want to caret to be near the left
			correctLeft = caretLeft - buffer;
		} else if (caretLeft > left + width) {
			// Because we want to caret to be near the right
			correctLeft = caretLeft - width + buffer + buffer;
		}
		if (correctTop || correctLeft) {
			win.scrollTo(correctLeft || left, correctTop || top);
		}
	}

	/**
	 * Computes a table of the given override and those collected at the given
	 * node.
	 *
	 * An object with overrides mapped against their names.
	 *
	 * @private
	 * @param  {!Node}      node
	 * @param  {!Selection} selection
	 * @return {Object}
	 */
	function mapOverrides(node, selection) {
		var overrides = Overrides.joinToSet(
			selection.formatting,
			Overrides.harvest(node),
			selection.overrides
		);
		var map = Maps.merge(Maps.mapTuples(overrides));
		if (!map['color']) {
			map['color'] = Dom.getComputedStyle(
				Dom.isTextNode(node) ? node.parentNode : node,
				'color'
			);
		}
		return map;
	}

	function drawBox(box, doc) {
		var elem = doc.createElement('div');
		Maps.extend(elem.style, {
			'top'        : box.top + 'px',
			'left'       : box.left + 'px',
			'height'     : box.height + 'px',
			'width'      : box.width + 'px',
			'position'   : 'absolute',
			'background' : 'red',
			'opacity'    : 0.4
		});
		Dom.addClass(elem, 'aloha-selection-box', 'aloha-ephemera');
		Dom.append(elem, doc.body);
		return elem;
	}

	/**
	 * Updates selection
	 *
	 * @param  {AlohaEvent} event
	 * @return {AlohaEvent}
	 * @memberOf selections
	 */
	function middleware(event) {
		if (!handlers[event.type]) {
			return event;
		}
		var selection = event.selection;
		var change = handlers[event.type](
			event,
			selection.boundaries,
			selection.focus,
			selection.previousBoundaries,
			Events.hasKeyModifier(event, 'shift')
		);
		selection.focus = change.focus;
		selection.boundaries = change.boundaries;
		// FIX ME: This check should not be necessary
		/*
		if (selection.boundaries[0] && aloha['highlights']) {
			highlight(selection.boundaries[0], selection.boundaries[1]).forEach(function (box) {
				Dom.setStyle(box, 'background', '#fce05e'); // or blue #a6c7f7
			});
		}
		*/
		return event;
	}

	/**
	 * Whether the given event will cause the position of the selection to move.
	 *
	 * @private
	 * @param  {Event} event
	 * @return {boolean}
	 */
	function isCaretMovingEvent(event) {
		if ('keypress' === event.type) {
			return true;
		}
		if ('paste' === event.type) {
			return true;
		}
		if (Keys.ARROWS[event.keycode]) {
			return true;
		}
		if (Keys.CODES['pageDown'] === event.keycode || Keys.CODES['pageUp'] === event.keycode) {
			return true;
		}
		if (Keys.CODES['undo'] === event.keycode) {
			if ('meta' === event.meta || 'ctrl' === event.meta || 'shift' === event.meta) {
				return true;
			}
		}
		if (Keys.CODES['enter'] === event.keycode) {
			return true;
		}
		return false;
	}

	var MOBILE_EVENT_TYPE = /^mobile\./;

	/**
	 * Causes the selection for the given event to be set to the browser and the
	 * caret position to be visualized.
	 *
	 * @param  {!Event} event
	 * @return {?Selection}
	 */
	function update(event) {
		var selection = event.selection;
		if (MOBILE_EVENT_TYPE.test(event.type)) {
			return;
		}
		if (event.preventSelection || (selection.dragging && 'dragover' !== event.type)) {
			return;
		}
		if ('leave' === event.type) {
			Dom.setStyle(selection.caret, 'display', 'none');
			return;
		}
		var type = event.type;
		if ('mouseup' === type || 'click' === type || 'dblclick' === type) {
			Dom.setStyle(selection.caret, 'display', 'block');
			return;
		}
		selection = select(
			selection,
			selection.boundaries[0],
			selection.boundaries[1],
			selection.focus
		);
		var boundary = selection.focus === 'start' ? selection.boundaries[0] : selection.boundaries[1];
		// Because we don't want the screen to jump when the editor hits "shift"
		if (isCaretMovingEvent(event)) {
			focus(boundary);
		}
		return selection;
	}

	/**
	 * Selects the given boundaries and visualizes the caret position.
	 *
	 * Returns the updated Selection object, that can be reassigned to
	 * aloha.editor.selection
	 *
	 * @param  {Selection} selection
	 * @param  {Boundary}  start
	 * @param  {Boundary}  end
	 * @param  {string=}   focus optional. "start" or "end". Defaults to "end"
	 * @return {Selection}
	 * @memberOf selections
	 */
	function select(selection, start, end, focus) {
		var boundary = 'start' === focus ? start : end;
		var node = Boundaries.container(boundary);
		if (!Dom.isEditableNode(node)) {
			Dom.setStyle(selection.caret, 'display', 'none');
			return selection;
		}
		show(selection.caret, boundary);
		Maps.extend(
			selection.caret.style,
			stylesFromOverrides(mapOverrides(node, selection))
		);
		var fontNode = Dom.getComputedStyle(
			Dom.isTextNode(node) ? node.parentNode : node,
			'font-size'
		);
		Dom.setStyle(selection.caret, 'font-size', fontNode);
		Boundaries.select(start, end);
		selection.blinking.start();
		return Maps.merge(selection, { 
			boundaries : [start, end],
			focus      : focus
		});
	}

	/**
	 * Returns true if obj is a selection as returned by a selection context
	 * object.
	 *
	 * @param  {*} obj
	 * @return {boolean}
	 * @memberOf selections
	 */
	function is(obj) {
		if (obj &&
			obj.hasOwnPropery &&
			obj.hasOwnProperty('focus') &&
			obj.hasOwnProperty('caret') &&
			obj.hasOwnProperty('boundaries')) {
			return true;
		}
		return false;
	}

	var MOUSE_EVENT = {
		'mousemove'      : true,
		'mousedown'      : true,
		'mouseup'        : true,
		'click'          : true,
		'dblclick'       : true,
		'aloha.dblclick' : true,
		'aloha.tplclick' : true
	};

	var CLICKING_EVENT = {
		'mousedown'      : true,
		'mouseup'        : true,
		'click'          : true,
		'dblclick'       : true,
		'aloha.dblclick' : true,
		'aloha.tplclick' : true
	};

	var MUTLICLICK_EVENT = {
		'dblclick'       : true,
		'aloha.dblclick' : true,
		'aloha.tplclick' : true
	};

	/**
	 * Returns the appropriate event type in the click cycle.
	 *
	 * <pre>
	 * Event cycle:
	 *     mousedown
	 *     mouseup
	 *     click
	 *     mousedown -> aloha.dblclick
	 *     mouseup
	 *     click
	 *     dblclick
	 *     mousedown -> aloha.tplclick
	 *     mouseup
	 *     click
	 * </pre>
	 *
	 * @private
	 * @param  {!Event}     event
	 * @param  {!Selection} selection
	 * @return {?string}
	 */
	function processClicking(event, selection) {
		if ('mousedown'      !== event.type &&
		    'dbclick'        !== event.type &&
		    'aloha.dblclick' !== event.type) {
			return null;
		}
		var time = new Date();
		var elapsed = time - selection.clickTimer;
		var multiclick = selection.multiclick;
		selection.multiclick = null;
		selection.clickTimer = time;
		if (elapsed > 500) {
			return null;
		}
		if (!selection.event) {
			return null;
		}
		if (selection.event.clientX !== event.clientX) {
			return null;
		}
		if (selection.event.clientY !== event.clientY) {
			return null;
		}
		return MUTLICLICK_EVENT[multiclick] ? 'aloha.tplclick' : 'aloha.dblclick';
	}

	/**
	 * Gets the dragging state.
	 *
	 * @private
	 * @param  {!Event}     event
	 * @param  {!Selection} selection
	 * @return {?string}
	 */
	function getDragging(event, selection) {
		if (selection.dragging) {
			return selection.dragging;
		}
		if ('mousemove' !== event.type) {
			return null;
		}
		var last = selection.lastMouseEvent;
		if ('mousedown'       === last ||
		    'aloha.dblclick'  === last ||
		    'aloha.tplclick'  === last) {
			return last;
		}
		return null;
	}

	function isMobileField(node, selection) {
		if (node === selection.caret) {
			return true;
		}
		var parent = node.parentNode;
		return (parent.parentNode === selection.caret)
		    && ('true' === Dom.getAttr(parent, 'contentEditable'));
	}

	/**
	 * Creates an event object that will contain the following properties:
	 *
	 * <pre>
	 *     type
	 *     nativeEvent
	 *     editable
	 *     selection
	 *     dnd
	 *     preventSelection
	 * </pre>
	 *
	 * @param  {!Editor} editor
	 * @param  {!Event}  event
	 * @return {?AlohaEvent}
	 * @memberOf selections
	 */
	function selectionEvent(editor, event) {
		var type = event.type;
		var doc = event.target.document || event.target.ownerDocument;
		var selection = editor.selection || Context(doc);
		var isClicking = CLICKING_EVENT[type] || false;
		var dragging = getDragging(event, selection);
		var isDragStart = dragging && dragging !== selection.dragging;
		var caretDisplay = Dom.getStyle(selection.caret, 'display');
		if (isClicking || isDragStart) {
			// Because otherwise if the mouse position is over the caret element
			// Boundaries.fromPosition() will compute the boundaries to be
			// inside the absolutely positioned caret element, which is not what
			// we want
			Dom.setStyle(selection.caret, 'display', 'none');
		}
		if (isDragStart) {
			selection.dragging = dragging;
		}
		if ('mousemove' === type) {
			return null;
		}
		if ('mouseup' === type && selection.dragging) {
			type = 'aloha.mouseup';
			selection.dragging = null;
		}
		if (isClicking) {
			type = processClicking(event, selection) || type;
		}
		if (MUTLICLICK_EVENT[type]) {
			selection.multiclick = type;
			Events.preventDefault(event);
		}
		if (MOUSE_EVENT[type]) {
			selection.lastMouseEvent = type;
		}
		var boundaries;
		if (isClicking) {
			var boundary = Boundaries.fromPosition(
				event.clientX + Dom.scrollLeft(doc),
				event.clientY + Dom.scrollTop(doc),
				doc
			);
			boundaries = boundary && [boundary, boundary];
		} else {
			boundaries = Boundaries.get(doc);
		}
		Dom.setStyle(selection.caret, 'display', caretDisplay);
		var editable;
		if (!boundaries) {
			if ('click' !== type && selection.boundaries) {
				editable = Editables.fromBoundary(editor, selection.boundaries[0]);
				return {
					preventSelection : false,
					type             : 'leave',
					nativeEvent      : event,
					editable         : editable,
					selection        : selection,
					dnd              : editor.dnd
				};
			}
			return null;
		}
		var cac = Boundaries.commonContainer(boundaries[0], boundaries[1]);
		var start = Boundaries.container(boundaries[0]);
		var end = Boundaries.container(boundaries[1]);
		var isPartial = !Dom.isEditableNode(cac)
		             && (Dom.isEditableNode(start) || Dom.isEditableNode(end));
		if ('keydown' === type && isPartial) {
			Events.preventDefault(event);
			return null;
		}
		editable = Editables.fromBoundary(editor, boundaries[0]);
		if (!editable) {
			if (isMobileField(Boundaries.container(boundaries[0]), selection)) {
				type = 'mobile.' + type;
			} else {
				return null;
			}
		}
		selection.overrides = editor.selection ? editor.selection.overrides : [];
		selection.previousBoundaries = selection.boundaries || boundaries;
		selection.boundaries = boundaries;
		selection.event = event;
		return {
			// TODO: Reconsider this
			// Because sometimes an interaction going through the editor pipe
			// should not result in an updated selection. eg: When inserting a
			// link you want to focus on an input field in the ui.
			preventSelection : false,
			type             : type,
			nativeEvent      : event,
			editable         : editable,
			selection        : selection,
			dnd              : editor.dnd
		};
	}

	/**
	 * Returns true if the given value is a Selection Event object as created by
	 * aloha.selections.selectionEvent.
	 *
	 * @param  {*} obj
	 * @return {boolean}
	 * @memberOf events
	 */
	function isSelectionEvent(obj) {
		return obj
		    && obj.hasOwnProperty
		    && obj.hasOwnProperty('dnd')
		    && obj.hasOwnProperty('editable')
		    && obj.hasOwnProperty('selection')
		    && obj.hasOwnProperty('nativeEvent');
	}

	return {
		is               : is,
		isSelectionEvent : isSelectionEvent,
		show             : show,
		select           : select,
		focus            : focus,
		update           : update,
		middleware       : middleware,
		Context          : Context,
		hideCarets       : hideCarets,
		unhideCarets     : unhideCarets,
		highlight        : highlight,
		selectionBoxes   : selectionBoxes,
		selectionEvent   : selectionEvent
	};
});
