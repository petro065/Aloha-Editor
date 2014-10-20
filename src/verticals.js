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

	var voidMarker = '♞';

	function harvest(element, offset, content, ranges) {
		var cumulative = offset;
		// Horizantal offsets into the content
		Dom.children(element).forEach(function (node) {
			var end;
			if (Dom.isTextNode(node)) {
				content.push(node.data);
				end = cumulative + node.data.length;
			} else if (Html.isVoidNode(node)) {
				content.push(voidMarker);
				end = cumulative + 1;
			} else {
				end = harvest(node, cumulative, content, ranges);
			}
			var range = [cumulative, end, node];
			if (ranges[cumulative]) {
				ranges[cumulative].push(range);
			} else {
				ranges[cumulative] = [range];
			}
			cumulative = end;
		});
		return cumulative;
	}

	var zwChars = Strings.ZERO_WIDTH_CHARACTERS.join('');
	var breakingWhiteSpaces = Arrays.difference(
		Strings.WHITE_SPACE_CHARACTERS,
		Strings.NON_BREAKING_SPACE_CHARACTERS
	).join('');

	var NOT_WSP_FROM_START = new RegExp('[^' + breakingWhiteSpaces + zwChars + ']');
	var WSP_FROM_START = new RegExp('[' + breakingWhiteSpaces + ']');

	function collectInsignificant(content) {
		var snippet = content;
		var contents = [];
		var ranges = {};
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
					ranges[offset] = [offset, offset + match];
				}
				offset++;
			}
			// Because `snippet` consists only of white spaces
			if (-1 === match) {
				ranges[offset] = [offset, offset + snippet.length];
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
		var count = 0;
		var string = contents.join('');
		Maps.forEach(ranges, function (obj, index) {
			var offset = parseInt(index, 10) + count;
			string = string.substring(0, offset) + '^' + string.substring(offset);
			count++;
		});
		console.warn(string);
	}

	function handle(boundaries) {
		var ranges = {};
		var contents = [];
		var block = closest(
			Boundaries.container(boundaries[0]),
			Html.hasLinebreakingStyle
		);
		harvest(block, 0, contents, ranges);
		collectInsignificant(contents.join(''), ranges);
	}

	window.verticals = handle;
});
