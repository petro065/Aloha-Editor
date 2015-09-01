/**
 * carets.js is part of Aloha Editor project http://www.alohaeditor.org
 *
 * Aloha Editor ● JavaScript Content Editing Library
 * Copyright (c) 2010-2015 Gentics Software GmbH, Vienna, Austria.
 * Contributors http://www.alohaeditor.org/docs/contributing.html
 * @namespace carets
 */
define([
	'dom',
	'html',
	'maps',
	'arrays',
	'browsers',
	'traversing',
	'boundaries'
], function (
	Dom,
	Html,
	Maps,
	Arrays,
	Browsers,
	Traversing,
	Boundaries
) {
	'use strict';

	/**
	 * Adds a style tag to the head of the given document if one does not
	 * already exist.
	 *
	 * Each document in which box() is called requires some special br css
	 * styling in order for box() to return calculate correct range bounding
	 * offsets near br elements.
	 *
	 * @see https://github.com/alohaeditor/Aloha-Editor/issues/1138
	 * @private
	 * @param {Document} doc
	 */
	function ensureBrStyleFix(doc) {
		if (doc['!aloha-br-style-fix']) {
			return;
		}
		var style = doc.createElement('style');
		var text = doc.createTextNode(
			'.aloha-editable br,.aloha-editable br:after{content:"\\A";white-space:pre-line;}'
		);
		Dom.append(text, style);
		Dom.append(style, doc.head);
		doc['!aloha-br-style-fix'] = true;
	}

	/**
	 * Removes an unrendered (empty text-) node infront of the given boundary.
	 *
	 * @private
	 * @param  {Boundary} boundary
	 * @return {Boundary}
	 */
	function trimPreceedingNode(boundary) {
		if (Boundaries.isTextBoundary(boundary)) {
			return boundary;
		}
		if (Boundaries.isAtStart(boundary)) {
			return boundary;
		}
		if (Html.isRendered(Boundaries.nodeBefore(boundary))) {
			return boundary;
		}
		var clone = Dom.clone(Boundaries.container(boundary), true);
		var offset = Boundaries.offset(boundary) - 1;
		Dom.remove(clone.childNodes[offset]);
		return Boundaries.create(clone, offset);
	}

	/**
	 * Expands the range one visual step to the left if possible, returns null
	 * otherwise.
	 *
	 * @private
	 * @param  {Range} range
	 * @return {?Range}
	 */
	function expandLeft(range) {
		var clone = range.cloneRange();
		var start = trimPreceedingNode(Boundaries.fromRangeStart(clone));
		var end = Boundaries.fromRangeEnd(clone);
		if (Boundaries.isAtStart(start)) {
			return null;
		}
		if (Html.hasLinebreakingStyle(Boundaries.prevNode(start))) {
			return null;
		}
		return Boundaries.range(stepLeft(start), end);
	}

	/**
	 * Expands the range one visual step to the right if possible, returns null
	 * otherwise.
	 *
	 * @private
	 * @param  {Range} range
	 * @return {?Range}
	 */
	function expandRight(range) {
		var start = Boundaries.fromRangeStart(range);
		var end = Boundaries.fromRangeEnd(range);
		if (Boundaries.isAtEnd(end)) {
			return null;
		}
		if (Html.hasLinebreakingStyle(Boundaries.nextNode(end))) {
			return null;
		}
		// Because this means that we cannot expand any further right inside the
		// container
		if (Html.isAtEnd(start)) {
			return null;
		}
		return Boundaries.range(start, stepRight(end));
	}

	/**
	 * Steps the given boundary one visual step left or until in behind of a
	 * line break position.
	 *
	 * @private
	 * @param  {Boundary} boundary
	 * @return {Boundary}
	 */
	function stepLeft(boundary) {
		var prev = Traversing.prev(boundary, 'char');
		if (prev) {
			return prev;
		}
		if (Html.hasLinebreakingStyle(Boundaries.prevNode(boundary))) {
			return boundary;
		}
		return stepLeft(Traversing.prev(boundary, 'boundary'));
	}

	/**
	 * Steps the given boundary one visual step right or until in front of a
	 * line break position.
	 *
	 * @private
	 * @param  {Boundary} boundary
	 * @return {Boundary}
	 */
	function stepRight(boundary) {
		var next = Traversing.next(boundary, 'char');
		if (next) {
			return next;
		}
		if (Html.hasLinebreakingStyle(Boundaries.nextNode(boundary))) {
			return boundary;
		}
		return stepRight(Traversing.next(boundary, 'boundary'));
	}

	/**
	 * Returns a mutable bounding client rectangle from the reference range or
	 * element.
	 *
	 * @param  {Element|Range} reference
	 * @return {Object.<string, number>}
	 */
	function boundingRect(reference) {
		// Because getBoundingClientRect at terminal position in text is broken
		var rects = Arrays.coerce(reference.getClientRects());
		var bounds = rects.reduce(function (bounds, rect) {
			bounds.top = Math.min(rect.top, bounds.top);
			bounds.left = Math.min(rect.left, bounds.left);
			bounds.bottom = Math.max(rect.top + rect.height, bounds.bottom);
			bounds.right = Math.max(rect.left + rect.width, bounds.right);
			return bounds;
		}, {
			top    : Infinity,
			left   : Infinity,
			right  : -Infinity,
			bottom : -Infinity
		});
		if (Infinity === bounds.top) {
			bounds = reference.getBoundingClientRect();
		}
		return {
			top    : bounds.top,
			left   : bounds.left,
			width  : bounds.right - bounds.left,
			height : bounds.bottom - bounds.top
		};
	}

	/**
	 * Shows a box element according to the dimensions and orientation of `box`.
	 *
	 * @param  {Object.<string, number>} box
	 * @param  {Document}                doc
	 * @return {Element}
	 * @memberOf carets
	 */
	function showHint(box, doc) {
		var elem = doc.querySelector('.aloha-caret-box-hint');
		if (!elem) {
			elem = doc.createElement('div');
			Dom.addClass(elem, 'aloha-caret-box-hint', 'aloha-ephemera');
		}
		Maps.extend(elem.style, {
			'top'        : box.top + 'px',
			'left'       : box.left + 'px',
			'height'     : box.height + 'px',
			'width'      : box.width + 'px',
			'position'   : 'absolute',
			'background' : 'red',
			'opacity'    : 0.2
		});
		Dom.append(elem, doc.body);
		return elem;
	}

	/**
	 * Removes any ".aloha-caret-box-hint" elements in the body of the given
	 * document and returns it.
	 *
	 * @param  {Document} doc
	 * @return {?Element}
	 * @memberOf carets
	 */
	function hideHint(doc) {
		var box = doc.querySelector('.aloha-caret-box-hint');
		if (box) {
			Dom.remove(box);
		}
		return box || null;
	}

	/**
	 * Checks whether or not we find ourselves in a situation in Chrome where it
	 * reports incorrect values when calling `boundingRect` with a collapsed
	 * range that is at a soft visual break.
	 *
	 * @private
	 * @param  {!Object.<string, int>} rect
	 * @param  {!Range}                range
	 * @return {boolean}
	 */
	function isChromeBug(rect, range) {
		if (!Browsers.chrome || !range.collapsed) {
			return false;
		}
		var element = Dom.upWhile(range.startContainer, Dom.isTextNode);
		var size = parseInt(Dom.getComputedStyle(element, 'font-size'), 10);
		return rect.width > size;
	}

	/**
	 * Attempts to calculates the bounding rectangle offsets for the given
	 * range.
	 *
	 * This function is a hack to work around the problems that user agents have
	 * in determining the bounding client rect for collapsed ranges.
	 *
	 * @private
	 * @param  {Range} range
	 * @return {Object.<string, number>}
	 */
	function bounds(range) {
		var rect;
		var collapsed = range.collapsed;
		var expanded = expandRight(range);
		if (expanded) {
			rect = boundingRect(expanded);
			if (rect.width && !isChromeBug(rect, range)) {
				if (collapsed && rect.width > 0) {
					rect.width = 1;
				}
				return rect;
			}
		}
		expanded = expandLeft(range);
		if (expanded) {
			rect = boundingRect(expanded);
			rect.left += rect.width;
			if (collapsed && rect.width > 0) {
				rect.width = 1;
			}
			return rect;
		}
		rect = boundingRect(range);
		if (collapsed && rect.width > 0) {
			rect.width = 1;
		}
		return rect;
	}

	/**
	 * Calculates the bounding box of the given range relative to the viewport
	 *
	 * @param {Boundary} start
	 * @param {Boundary} end
	 * @return {Object}
	 */
	function boundsFromBoundaries(start, end) {
		if (!end) {
			end = start;
		}

		var range = Boundaries.range(start, end);
		var rect = bounds(range);
		var doc = range.commonAncestorContainer.ownerDocument;

		ensureBrStyleFix(doc);

		// Because `rect` should be the box of an expanded range and must
		// therefore have a non-zero width if valid
		if (rect.width > 0) {
			return {
				top    : rect.top,
				left   : rect.left,
				width  : rect.width,
				height : rect.height
			};
		}

		var node = Boundaries.nodeAfter(start)
		        || Boundaries.nodeBefore(start);

		if (node && !Dom.isTextNode(node)) {
			rect = boundingRect(node);
			if (rect) {
				return {
					top    : rect.top,
					left   : rect.left,
					width  : rect.width,
					height : rect.height
				};
			}
		}

		// <li>{}</li>
		node = Boundaries.container(start);

		return {
			top    : node.offsetTop,
			left   : node.offsetLeft,
			width  : node.offsetWidth,
			height : parseInt(Dom.getComputedStyle(node, 'line-height'), 10)
		};
	}

	/**
	 * Gets the bounding box of offets in the document (not in the viewport) for
	 * the given range.
	 *
	 * This function requires the following css:
	 * .aloha-editable br, .aloha-editable br:after { content: "\A"; white-space: pre-line; }
	 *
	 * @param  {!Boundary} start
	 * @param  {Boundary=} end
	 * @return {Object.<string, number>}
	 * @memberOf carets
	 */
	function box(start, end) {
		if (!end) {
			end = start;
		}

		var range = Boundaries.range(start, end);
		var rect = bounds(range);
		var doc = range.commonAncestorContainer.ownerDocument;

		ensureBrStyleFix(doc);

		// Because `rect` should be the box of an expanded range and must
		// therefore have a non-zero width if valid
		if (rect.width > 0) {
			return {
				top    : rect.top + Dom.scrollTop(doc),
				left   : rect.left + Dom.scrollLeft(doc),
				width  : rect.width,
				height : rect.height
			};
		}

		var node = Boundaries.nodeAfter(start)
		        || Boundaries.nodeBefore(start);

		if (node && !Dom.isTextNode(node)) {
			rect = boundingRect(node);
			if (rect) {
				return {
					top    : rect.top + Dom.scrollTop(doc),
					left   : rect.left + Dom.scrollLeft(doc),
					width  : rect.width,
					height : rect.height
				};
			}
		}

		// <li>{}</li>
		node = Boundaries.container(start);

		return {
			top    : node.offsetTop + Dom.scrollTop(doc),
			left   : node.offsetLeft + Dom.scrollLeft(doc),
			width  : node.offsetWidth,
			height : parseInt(Dom.getComputedStyle(node, 'line-height'), 10)
		};
	}

	return {
		box                  : box,
		showHint             : showHint,
		hideHint             : hideHint,
		boundsFromElement    : boundingRect,
		boundsFromBoundaries : boundsFromBoundaries
	};
});

