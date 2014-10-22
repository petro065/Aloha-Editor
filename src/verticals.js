/**
 * verticals.js is part of Aloha Editor project http://aloha-editor.org
 *
 * Aloha Editor is a WYSIWYG HTML5 inline editing library and editor.
 * Copyright (c) 2010-2014 Gentics Software GmbH, Vienna, Austria.
 * Contributors http://aloha-editor.org/contribution.php
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

	function collectFormatting(element, offset) {
		offset = offset || 0;
		var ranges = [];
		var snippets = [];
		Dom.children(element).forEach(function (node) {
			var bit = getBit(node);
			var length;
			if (bit & LEAF) {
				var content = bit & TEXT ? node.data : VOID_MARKER;
				length = content.length;
				ranges.push([offset, length, node]);
				snippets.push(content);
			} else {
				var more = collectFormatting(node, offset);
				var range = Arrays.last(more.ranges);
				length = range[0] + range[1] - offset;
				ranges = ranges.concat([[offset, length, node]], more.ranges);
				snippets.push(more.content);
			}
			offset += length;
		});
		return {
			content : snippets.join(''),
			ranges  : ranges
		};
	}

	var zwChars = Strings.ZERO_WIDTH_CHARACTERS.join('');
	var breakingWhiteSpaces = Arrays.difference(
		Strings.WHITE_SPACE_CHARACTERS,
		Strings.NON_BREAKING_SPACE_CHARACTERS
	).join('');

	var NOT_WSP_FROM_START = new RegExp('[^' + breakingWhiteSpaces + zwChars + ']');
	var WSP_FROM_START = new RegExp('[' + breakingWhiteSpaces + ']');

	function collectWhitespaces(content, whitespaces, formatting) {
		var snippet = content;
		var contents = [];
		var offset = 0;
		var match;
		while (snippet.length > 0) {
			match = snippet.search(NOT_WSP_FROM_START);
			if (match > 0) {
				snippet = snippet.substring(match);
				// Because a single space character was encountered
				if (1 === match) {
					contents.push(' ');
				} else {
					// Because multiple spaces should be replaced with a single
					// space *except* at the beginning and end of the string
					if (offset > 0 && match < snippet.length) {
						contents.push(' ');
						match--;
					}
					whitespaces[offset] = [offset, match];
				}
				offset++;
			}
			// Because `snippet` consists only of white spaces
			if (-1 === match) {
				whitespaces[offset] = [offset, snippet.length];
				offset += snippet.length;
				break;
			}
			match = snippet.search(WSP_FROM_START);
			// Because there are no more white spaces
			if (-1 === match) {
				contents.push(snippet);
				break;
			}
			contents.push(snippet.substring(0, match));
			snippet = snippet.substring(match);
			offset += match;
		}
		return contents.join('');
	}

	function handle(boundaries) {
		var block = closest(
			Boundaries.container(boundaries[0]),
			Html.hasLinebreakingStyle
		);
		Dom.remove(block.querySelector('br'));
		console.log(block.innerHTML.replace(/\s/g, '·'));

		var yarn = collectFormatting(block);

		console.log(yarn.content);

		var str = [];
		Maps.forEach(yarn.ranges, function (range) {
			str.push('{' + range[2].nodeName + ' "' + yarn.content.substring(range[0], range[0] + range[1]) + '"}');
		});

		console.dir(str);


		string = collectWhitespaces(string, whitespaces, formatting);
		output = string;
		count = 0;
		Maps.forEach(whitespaces, function (range, index) {
			var marker = '^';
			var offset = range[0] + count;
			output = output.substring(0, offset) + marker + output.substring(offset);
			count += marker.length;
		});
		console.warn(output.replace(/\s/g, '·'));

		Maps.forEach(whitespaces, function (range, index) {
			console.error(range);
		});

		/*
		output = string;
		count = 0;
		Maps.forEach(formatting, function (obj, index) {
			var marker = '^';
			var offset = parseInt(index, 10) + count;
			output = output.substring(0, offset) + marker + output.substring(offset);
			count += marker.length;
		});
		console.warn(output.replace(/\s/g, '·'));
		*/
	}

	window.verticals = handle;
});
