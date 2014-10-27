/**
 * deranged.js is part of Aloha Editor project http://aloha-editor.org
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

	var TESTS = true;

	// `readMarkers

	function readMarkers(marked) {
		var onlyBrackets = marked.replace(/[\{\}\|]/g, '');
		var bracketsStart = onlyBrackets.search(/\[/);
		var bracketsEnd = onlyBrackets.search(/\]/) - 1;
		var brackets = bracketsStart > -1 && bracketsEnd > -1
		             ? [bracketsStart, bracketsEnd]
		             : [];
		var onlyBraces = marked.replace(/[\[\]\|]/g, '');
		var bracesStart = onlyBraces.search(/\{/);
		var bracesEnd = onlyBraces.search(/\}/) - 1;
		var braces = bracesStart > -1 && bracesEnd > -1
		           ? [bracesStart, bracesEnd]
		           : [];
		return {
			brackets : brackets,
			braces   : braces,
			single   : marked.replace(/[\{\}\[\]]/g, '').search(/\|/),
			content  : marked.replace(/[\{\}\[\]\|]/g, '')
		};
	}

	if (TESTS) {
		[{
			test     : '012[345]6789',
			content  : '0123456789',
			braces   : [],
			brackets : [3, 6],
			single   : -1
		}, {
			test     : '0|12[345]6789',
			content  : '0123456789',
			braces   : [],
			brackets : [3, 6],
			single   : 1
		}, {
			test     : '0{1}2[345]6789',
			content  : '0123456789',
			braces   : [1, 2],
			brackets : [3, 6],
			single   : -1
		}, {
			test     : '0{12[3}45]6789',
			content  : '0123456789',
			braces   : [1, 4],
			brackets : [3, 6],
			single   : -1
		}].forEach(function (test) {
			var markers = readMarkers(test.test);
			Maps.forEach(markers, function (value, key) {
				if (test[key].toString() !== value.toString()) {
					console.error(
						'readMarkers() test:',
						'Expected ' + key + ' to be "' + value + '", but got "' + test[key] + '"'
					);
				}
			});
		});
	}

	// `remove

	function remove(deranged, start, end) {
		var content = deranged.content;
		return {
			content : content.substring(0, start) + content.substring(end),
			ranges  : deranged.ranges.reduce(function (list, item) {
				var a = item[0];
				var b = item[1];
				if (!a || !b || (a >= start && b <= end)) {
					return list.concat([[]]);
				}
				if (start < a) {
					a = a - (Math.min(a, end) - start);
				}
				if (start < b) {
					b = b - (Math.min(b, end) - start);
				}
				return list.concat([[a, b].concat(item.slice(2))]);
			}, [])
		};
	}

	if (TESTS) {
		(function () {
			var original = [];
			var expected = [];
			[

				//   |
				//   { }
				//   {   }
				//   {       }
				//   {             }
				//       [     ]
				// 0 1 2 3 4 5 6 7 8 9
				['0{1}23456789', '0{1}26789'],
				['0{12}3456789', '0{12}6789'],
				['0{1234}56789', '0{12}6789'],
				['0{1234567}89', '0{1267}89'],

				//       |
				//       {   }
				//       {     }
				//       {         }
				//       [     ]
				// 0 1 2 3 4 5 6 7 8 9
				['012{34}56789', '0126789'],
				['012{345}6789', '0126789'],
				['012{34567}89', '012{67}89'],

				//         |
				//         { }
				//         {   }
				//         {       }
				//       [     ]
				// 0 1 2 3 4 5 6 7 8 9
				['0123{4}56789', '0126789'],
				['0123{45}6789', '0126789'],
				['0123{4567}89', '012{67}89'],

				//             |
				//             {   }
				//       [     ]
				// 0 1 2 3 4 5 6 7 8 9
				['012345{67}89', '012{67}89'],

				//               |
				//               { }
				//       [     ]
				// 0 1 2 3 4 5 6 7 8 9
				['0123456{7}89', '0126{7}89']
			].forEach(function (test) {
				original.push(readMarkers(test[0]).braces);
				expected.push(readMarkers(test[1]).braces);
			});
			var range = readMarkers('012{345}6789').braces;
			var result = remove({
				content : '0123456789',
				ranges  : original
			}, range[0], range[1]);
			if ('0126789' !== result.content) {
				console.error('remove() tests: result.content don\'t match');
			}
			var preserved = result.ranges;
			expected.forEach(function (expected, index) {
				if (expected.toString() !== preserved[index].toString()) {
					console.error(
						'remove() tests #' + index + ': Expected "',
						expected.toString() || '   ',
						'" but got "',
						preserved[index].toString() || '   ',
						'"'
					);
				}
			});
		}());
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

	function parseDom(element, offset) {
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
				var more = parseDom(node, offset);
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

	// `parseDom

	if (TESTS) {
		[{
			markup  : '<div>foo<u>ba<i>r</i> baz</u><img/>  qux</div>',
			content : 'foobar baz' + VOID_MARKER + '  qux',
			control : 'foo{ba[r] baz}' + VOID_MARKER + '  qux',
			markers : {
				U : 'braces',
				I : 'brackets'
			}
		}].forEach(function (test) {
			var deranged = parseDom(Html.parse(test.markup, document)[0]);
			if (test.content !== deranged.content) {
				console.error(
					'parseDom() test:',
					'Expected "', test.content, '" ',
					'but got "', deranged.content, '"'
				);
			}
			var markers = readMarkers(test.control);
			deranged.ranges.forEach(function (range) {
				var marker = test.markers[range[2].nodeName];
				if (marker && (range.slice(0, -1).toString() !==  markers[marker].toString())) {
					console.error(
						'parseDom() test:',
						'Expected "', markers[marker].toString(), '" ',
						'but got "', range.slice(0, -1).toString(), '"'
					);
				}
			});
		});
	}

	// `extractCollapsed
	//
	var zwChars = Strings.ZERO_WIDTH_CHARACTERS.join('');
	var breakingWhiteSpaces = Arrays.difference(
		Strings.WHITE_SPACE_CHARACTERS,
		Strings.NON_BREAKING_SPACE_CHARACTERS
	).join('');

	var NOT_WSP_FROM_START = new RegExp('[^' + breakingWhiteSpaces + zwChars + ']');
	var WSP_FROM_START = new RegExp('[' + breakingWhiteSpaces + ']');

	function extractCollapsed(deranged) {
		var content = deranged.content;
		var collapsed = [];
		var offset = 0;
		var guard = 99;
		var match;
		while (--guard) {
			match = content.search(NOT_WSP_FROM_START);
			// Only whitespaces
			if (-1 === match) {
				collapsed.push([offset, content.substring(0, content)]);
				break;
			}
			// No leading whitespaces
			if (0 === match) {
				match = content.search(WSP_FROM_START);
				// No more white spaces
				if (-1 === match) {
					break;
				}
				offset += match;
				content = content.substring(match);

			// Leading white space found
			// eg: " foo bar"
			// But multiple spaces should be replaced with a single space
			// *except* at the beginning and end of the string
			} else if (0 === offset || match === content.length) {
				collapsed.push([offset, content.substring(0, match)]);
				deranged = remove(deranged, offset, offset + match);
				content = deranged.content;
			} else if (1 === match) {
				offset++;
				content = content.substring(1);
			} else {
				offset++;
				collapsed.push([offset, content.substring(1, match)]);
				deranged = remove(deranged, offset, offset + match - 1);
				content = content.substring(match);
			}
		}
		deranged.collapsed = collapsed;
		return deranged;
	}

	if (TESTS) {
		[{
			markup  : '<div> &nbsp;foo &nbsp;&nbsp;<u>ba<i>r</i> baz</u>      qux</div>',
			content : ' foo   bar baz qux',
		}].forEach(function (test) {
			var deranged = parseDom(Html.parse(test.markup, document)[0]);
			var deranged2 = extractCollapsed(deranged);
			console.log('|' + deranged.content + '|');
			console.log(deranged);
		});
	}

	window.verticals = function () {};
});
