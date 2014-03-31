/**
 * html/elements.js is part of Aloha Editor project http://aloha-editor.org
 *
 * Aloha Editor is a WYSIWYG HTML5 inline editing library and editor.
 * Copyright (c) 2010-2014 Gentics Software GmbH, Vienna, Austria.
 * Contributors http://aloha-editor.org/contribution.php
 */
define([
	'html/styles',
	'html/predicates',
	'dom',
	'arrays',
	'cursors',
	'strings',
	'boundaries'
], function HtmlElements(
	Styles,
	Predicates,
	Dom,
	Arrays,
	Cursors,
	Strings,
	Boundaries
) {
	'use strict';

	/**
	 * Checks whether the given node should be treated like a void element.
	 *
	 * Void elements like IMG and INPUT are considered as void type, but so are
	 * "block" (elements inside of editale regions that are not themselves
	 * editable).
	 *
	 * @param  {Node} node
	 * @return {boolean}
	 */
	function isVoidType(node) {
		return Predicates.isVoidNode(node) || !Dom.isEditableNode(node);
	}

	/**
	 * Returns true if the given node is unrendered whitespace, with the caveat
	 * that it only examines the given node and not any siblings.  An additional
	 * check is necessary to determine whether the node occurs after/before a
	 * linebreaking node.
	 *
	 * Taken from
	 * http://code.google.com/p/rangy/source/browse/trunk/src/js/modules/rangy-cssclassapplier.js
	 * under the MIT license.
	 *
	 * @private
	 * @param  {Node} node
	 * @return {boolean}
	 */
	function isUnrenderedWhitespaceNoBlockCheck(node) {
		if (!Dom.isTextNode(node)) {
			return false;
		}
		if (!node.length) {
			return true;
		}
		if (Strings.NOT_SPACE.test(node.nodeValue)) {
			return false;
		}
		var cssWhiteSpace;
		if (node.parentNode) {
			cssWhiteSpace = Dom.getComputedStyle(node.parentNode, 'white-space');
			if (Styles.isWhiteSpacePreserveStyle(cssWhiteSpace)) {
				return false;
			}
		}
		if ('pre-line' === cssWhiteSpace) {
            if (/[\r\n]/.test(node.data)) {
                return false;
            }
        }
		return true;
	}

	/**
	 * Tags representing non-block-level elements which are nevertheless line
	 * breaking.
	 *
	 * @private
	 * @type {Object.<string, boolean>}
	 */
	var LINE_BREAKING_VOID_ELEMENTS = {
		'BR'  : true,
		'HR'  : true,
		'IMG' : true
	};

	/**
	 * Returns true if the node at point is unrendered, with the caveat that it
	 * only examines the node at point and not any siblings.  An additional
	 * check is necessary to determine whether the whitespace occurrs
	 * after/before a linebreaking node.
	 *
	 * @private
	 */
	function isUnrenderedAtPoint(point) {
		return (isUnrenderedWhitespaceNoBlockCheck(point.node)
				|| (Dom.isElementNode(point.node)
					&& Styles.hasInlineStyle(point.node)
					&& !LINE_BREAKING_VOID_ELEMENTS[point.node]));
	}

	/**
	 * Tries to move the given point to the end of the line, stopping to the
	 * left of a br or block node, ignoring any unrendered nodes. Returns true
	 * if the point was successfully moved to the end of the line, false if some
	 * rendered content was encountered on the way. point will not be mutated
	 * unless true is returned.
	 *
	 * @private
	 * @param  {Cursor} point
	 * @return {boolean} True if the cursor is moved
	 */
	function skipUnrenderedToEndOfLine(point) {
		var cursor = point.clone();
		cursor.nextWhile(isUnrenderedAtPoint);
		if (!Styles.hasLinebreakingStyle(cursor.node)) {
			return false;
		}
		point.setFrom(cursor);
		return true;
	}

	/**
	 * Tries to move the given point to the start of the line, stopping to the
	 * right of a br or block node, ignoring any unrendered nodes. Returns true
	 * if the point was successfully moved to the start of the line, false if
	 * some rendered content was encountered on the way. point will not be
	 * mutated unless true is returned.
	 *
	 * @private
	 * @param {Cursor} point
	 * @return {boolean} True if the cursor is moved
	 */
	function skipUnrenderedToStartOfLine(point) {
		var cursor = point.clone();
		cursor.prev();
		cursor.prevWhile(isUnrenderedAtPoint);
		if (!Styles.hasLinebreakingStyle(cursor.node)) {
			return false;
		}
		var isBr = ('BR' === cursor.node.nodeName);
		cursor.next(); // after/out of the linebreaking node
		// Because point may be to the right of a br at the end of a
		// block, in which case the line starts before the br.
		if (isBr) {
			var endOfBlock = point.clone();
			if (skipUnrenderedToEndOfLine(endOfBlock) && endOfBlock.atEnd) {
				cursor.skipPrev(); // before the br
				cursor.prevWhile(isUnrenderedAtPoint);
				if (!Styles.hasLinebreakingStyle(cursor.node)) {
					return false;
				}
				cursor.next(); // after/out of the linebreaking node
			}
		}
		point.setFrom(cursor);
		return true;
	}

	/**
	 * Returns true if the given node is unrendered whitespace.
	 *
	 * @param  {Node} node
	 * @return {boolean}
	 */
	function isUnrenderedWhitespace(node) {
		if (!isUnrenderedWhitespaceNoBlockCheck(node)) {
			return false;
		}
		return skipUnrenderedToEndOfLine(Cursors.cursor(node, false))
		    || skipUnrenderedToStartOfLine(Cursors.cursor(node, false));
	}

	/**
	 * Returns true if node is either the first or last child of its parent.
	 *
	 * @private
	 * @param  {Node} node
	 * @return {boolean}
	 */
	function isTerminalNode(node) {
		var parent = node.parentNode;
		return parent
		    && (node === parent.firstChild || node === parent.lastChild);
	}

	/**
	 * Checks whether the given node is next to a block level element.
	 *
	 * @private
	 * @param  {Node} node
	 * @return {boolean}
	 */
	function isAdjacentToBlock(node) {
		return (node.previousSibling && Predicates.isBlockNode(node.previousSibling))
		    || (node.nextSibling && Predicates.isBlockNode(node.nextSibling));
	}

	function isRenderedNode(node) {
		// Because LI or TD are rendered even when empty
		if (Predicates.isGroupedElement(node)) {
			return true;
		}
		// BR or HR or IMG are rendered despite being empty
		if (Predicates.isVoidNode(node)) {
			return ('BR' === node.nodeName) ? isRenderedBr(node) : true;
		}
		// #text
		if (Dom.isTextNode(node)) {
			if (!isUnrenderedWhitespaceNoBlockCheck(node)) {
				return true;
			}
			var parent = node.parentNode;
			if (!parent || !Styles.hasLinebreakingStyle(parent)) {
				return true;
			}
			var siblings = Arrays.split(Dom.siblings(node), function (sibling) {
				return sibling === node;
			});
			var prev = siblings[0];
			var next = siblings[1].slice(1);
			return prev.filter(isRenderedNode).length > 0
			    && next.filter(isRenderedNode).length > 0;
		}
		// Because with no visible children, a node is visually empty and
		// unrendered
		return Dom.children(node).filter(isRenderedNode).length > 0;
	}

	/**
	 * Checks whether the given node is visually rendered according to HTML5
	 * specification.
	 *
	 * @param  {Node} node
	 * @return {boolean}
	 */
	function isUnrendered(node) {
		return !isRenderedNode(node);
	}

	/**
	 * Returns true of the given node is rendered.
	 *
	 * @param  {Node} node
	 * @return {boolean}
	 */
	function isRendered(node) {
		return isRenderedNode(node);
	}

	/**
	 * Checks whether or not the given node is a significant BR element.
	 *
	 * @param  {Node} node
	 * @return {boolean}
	 */
	function isRenderedBr(node) {
		if ('BR' !== node.nodeName) {
			return false;
		}

		var ignorable = function (node) {
			if ('BR' === node.nodeName) {
				return false;
			}
			if (!Dom.isTextNode(node)) {
				return Dom.children(node).length > 0;
			}
			if (!isUnrenderedWhitespaceNoBlockCheck(node)) {
				return false;
			}
			return isTerminalNode(node);
		};

		var prev = node.previousSibling
		        && Dom.prevWhile(node.previousSibling, ignorable);

		var next = node.nextSibling
		        && Dom.nextWhile(node.nextSibling, ignorable);

		// Because a br between two visible siblings in an inline node is
		// rendered
		if (prev && next && Predicates.isInlineNode(node.parentNode)) {
			return true;
		}

		// Because a br between two br or inline nodes is rendered
		if ((prev && ('BR' === prev.nodeName || !Styles.hasLinebreakingStyle(prev)))
				&&
				(next && ('BR' === next.nodeName || !Styles.hasLinebreakingStyle(next)))) {
			return true;
		}

		// Because a br next to another br will mean that both are rendered
		if ((prev && ('BR' === prev.nodeName))
				||
				(next && ('BR' === next.nodeName))) {
			return true;
		}

		// Because a br is the first space-consuming *tag* inside of a
		// line-breaking element is rendered
		var boundary = Boundaries.fromNode(node);
		while (isAtStart(boundary)) {
			if (Styles.hasLinebreakingStyle(Boundaries.container(boundary))) {
				return true;
			}
			boundary = Boundaries.prev(boundary);
		}

		boundary = Boundaries.jumpOver(Boundaries.fromNode(node));
		while (isAtEnd(boundary)) {
			if (Styles.hasLinebreakingStyle(Boundaries.container(boundary))) {
				return false;
			}
			boundary = Boundaries.next(boundary);
		}

		return !Styles.hasLinebreakingStyle(nextNode(boundary));
	}

	var zwChars = Strings.ZERO_WIDTH_CHARACTERS.join('');
	var breakingWhiteSpaces = Arrays.difference(
		Strings.WHITE_SPACE_CHARACTERS,
		Strings.NON_BREAKING_SPACE_CHARACTERS
	).join('');
	var NOT_WSP = new RegExp('[^' + breakingWhiteSpaces + zwChars + ']');

	/**
	 * Checks whether a boundary represents a position that at the apparent end
	 * of its container's content.
	 *
	 * Unlike Boundaries.isAtEnd(), it considers the boundary position with
	 * respect to how it is visually represented, rather than simply where it
	 * is in the DOM tree.
	 *
	 * @private
	 * @param  {Boundary} boundary
	 * @return {boolean}
	 */
	function isAtEnd(boundary) {
		if (Boundaries.isAtEnd(boundary)) {
			// |</p>
			return true;
		}
		if (Boundaries.isTextBoundary(boundary)) {
			// "fo|o" or "foo| "
			return !NOT_WSP.test(Boundaries.container(boundary).data.substr(
				Boundaries.offset(boundary)
			));
		}
		var node = Boundaries.nodeAfter(boundary);
		// foo|<br></p> or foo|<i>bar</i>
		return !Dom.nextWhile(node, isUnrendered);
	}

	/**
	 * Checks whether a boundary represents a position that at the apparent
	 * start of its container's content.
	 *
	 * Unlike Boundaries.isAtStart(), it considers the boundary position with
	 * respect to how it is visually represented, rather than simply where it
	 * is in the DOM tree.
	 *
	 * @private
	 * @param  {Boundary} boundary
	 * @return {boolean}
	 */
	function isAtStart(boundary) {
		if (Boundaries.isAtStart(boundary)) {
			return true;
		}
		if (Boundaries.isTextBoundary(boundary)) {
			return !NOT_WSP.test(Boundaries.container(boundary).data.substr(
				0,
				Boundaries.offset(boundary)
			));
		}
		var node = Boundaries.nodeBefore(boundary);
		return !Dom.prevWhile(node, isUnrendered);
	}

	/**
	 * Like Boundaries.nextNode(), except that it considers whether a boundary
	 * is at the end position with respect to how the boundary is visual
	 * represented, rather than simply where it is in the DOM structure.
	 *
	 * @param  {Boundary} boundary
	 * @return {Node}
	 */
	function nextNode(boundary) {
		return isAtEnd(boundary)
		     ? Boundaries.container(boundary)
		     : Boundaries.nodeAfter(boundary);
	}

	/**
	 * Like Boundaries.prevNode(), except that it considers whether a boundary
	 * is at the start position with respect to how the boundary is visual
	 * represented, rather than simply where it is in the DOM structure.
	 *
	 * @param  {Boundary} boundary
	 * @return {Node}
	 */
	function prevNode(boundary) {
		return isAtEnd(boundary)
		     ? Boundaries.container(boundary)
		     : Boundaries.nodeBefore(boundary);
	}

	/**
	 * Parses the given markup string into a DOM tree inside of a detached div
	 * element.
	 *
	 * @param  {string}   html
	 * @param  {Document} doc
	 * @return {Element}
	 */
	function parse(html, doc) {
		var div = doc.createElement('div');
		div.innerHTML = html;
		return div;
	}

	return {
		parse                              : parse,
		isVoidType                         : isVoidType,
		isRendered                         : isRendered,
		isUnrendered                       : isUnrendered,
		isUnrenderedWhitespace             : isUnrenderedWhitespace,
		isUnrenderedWhitespaceNoBlockCheck : isUnrenderedWhitespaceNoBlockCheck,
		skipUnrenderedToEndOfLine          : skipUnrenderedToEndOfLine,
		skipUnrenderedToStartOfLine        : skipUnrenderedToStartOfLine
	};
});
