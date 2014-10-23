/**
 * verticals.js is part of Aloha Editor project http://aloha-editor.org
 *
 * Aloha Editor is a WYSIWYG HTML5 inline editing library and editor.
 * Copyright (c) 2010-2014 Gentics Software GmbH, Vienna, Austria.
 * Contributors http://aloha-editor.org/contribution.php
 *
 *  2 text nodes "f" and "oo"
 *  |
 *  v
 * foo<u>ba<i>r</i> baz</u>  qux
 * | | |    |    |       |     |
 * 0 2 3    5    6       10    15
 *
 *  slit (1,1)
 *  | u (3, 10)
 *  | | i (5, 6)
 *  | | |
 * foobar baz  qux
 */
define([
	'dom',
	'html',
	'maps',
	'arrays',
	'strings',
	'functions',
	'boundaries'
], function (
	Dom,
	Html,
	Maps,
	Arrays,
	Strings,
	Fn,
	Boundaries
) {
	'use strict';

	function closest(node, match) {
		return Dom.upWhile(node, Fn.complement(match));
	}

	var VOID_MARKER = '♞';
	var LEAF = 1 << 0;
	var TEXT = 1 << 1;
	var VOID = 1 << 2;
	var META = 1 << 3;

	function getBit(node) {
		if (Dom.isTextNode(node)) {
			return TEXT | LEAF;
		}
		if (Html.isVoidNode(node)) {
			return VOID | LEAF;
		}
		return META;
	}

	function extractFormatting(element, offset) {
		offset = offset || 0;
		var ranges = [];
		var snippets = [];
		var wasText = false;
		Dom.children(element).forEach(function (node) {
			var bit = getBit(node);
			var length;
			if (bit & TEXT) {
				if (wasText) {
					ranges.push([offset, offset, 'split']);
				}
				wasText = true;
				snippets.push(node.data);
				length = node.data.length;
			} else if (bit & VOID) {
				wasText = false;
				snippets.push(VOID_MARKER);
				length = 1;
			} else {
				wasText = false;
				var more = extractFormatting(node, offset);
				ranges = ranges.concat(
					[[offset, offset + more.content.length, node]],
					more.ranges
				);
				snippets.push(more.content);
				length += more.content.length;
			}
			offset += length;
		});
		return {
			content   : snippets.join(''),
			collapsed : [],
			ranges    : ranges
		};
	}

	var zwChars = Strings.ZERO_WIDTH_CHARACTERS.join('');
	var breakingWhiteSpaces = Arrays.difference(
		Strings.WHITE_SPACE_CHARACTERS,
		Strings.NON_BREAKING_SPACE_CHARACTERS
	).join('');

	var NOT_WSP_FROM_START = new RegExp('[^' + breakingWhiteSpaces + zwChars + ']');
	var WSP_FROM_START = new RegExp('[' + breakingWhiteSpaces + ']');

	function splice(yarn, start, count, insert) {
		var original = yarn.content;
		var edited = original.substring(0, start)
		           + (insert || '')
		           + original.substring(start + count);
		return Maps.merge(yarn, {content: edited});
	}

	function extractCollapsed(yarn) {
		var collapsed = [];
		var offset = 0;
		var match;
		var snippet = yarn.content;
		while (yarn.content.length > offset) {
			match = snippet.search(NOT_WSP_FROM_START);
			// Because `snippet` consists only of white spaces
			// eg: "   "
			if (-1 === match) {
				collapsed.push([offset, snippet]);
				yarn = splice(yarn, offset, snippet.length);
				break;
			} else if (0 === match) {
				// Because `snippet` contains no leading white spaces
				// eg: "foo bar"
				match = snippet.search(WSP_FROM_START);
				// Because there are no more white spaces
				if (-1 === match) {
					break;
				}
				offset += match;
				snippet = snippet.substring(match);
			} else {
				// Because leading white space is found
				// eg: " foo bar"
				// But multiple spaces should be replaced with a single space
				// *except* at the beginning and end of the string
				if (offset > 0 && match < snippet.length) {
					offset++;
					collapsed.push([offset, snippet.substring(1, match)]);
					yarn = splice(yarn, offset, match - 1);
				} else {
					collapsed.push([offset, snippet.substring(0, match)]);
					yarn = splice(yarn, offset, match);
				}
				snippet = snippet.substring(match);
			}
		}
		return yarn;
	}

	function create(boundaries) {
		var block = closest(
			Boundaries.container(boundaries[0]),
			Html.hasLinebreakingStyle
		);
		Dom.remove(block.querySelector('br'));
		console.log(block.innerHTML.replace(/\s/g, '·'));

		var yarn = extractFormatting(block);
		var result = extractCollapsed(yarn);

		console.log(result.content);

		var str = yarn.content;
		var offset = 0;
		Maps.forEach(yarn.ranges, function (range) {
			var start = range[0] + offset;
			var end = range[1] + offset;
			if ('split' === range[2]) {
				str = str.substring(0, start) + '|' + str.substring(end);
				offset++;
			} else {
				var mark = '[' + range[2].nodeName + ' ';
				str = str.substring(0, start)
				    + mark + str.substring(start, end) + ']'
				    + str.substring(end);
				offset += mark.length;
			}
		});
		console.log('{' + str + '}');
	}

	window.verticals = create;
});
