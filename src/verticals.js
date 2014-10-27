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

	var TESTS = true;

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

	function splice(yarn, start, count, text) {
		var end = start + count;
		var insert = text || '';
		var content = yarn.content.substring(0, start)
		            + insert
		            + yarn.content.substring(end);

		var adjusted = yarn.ranges.reduce(function (ranges, range) {
			var a = range[0];
			var b = range[1];
			return ranges.concat(range);
		}, []);

		return {
			content   : content,
			ranges    : adjusted.concat(),
			collapsed : yarn.collapsed.concat()
		};
	}

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

	function remove(content, start, end, preserve) {
		var mutated = content.substr(0, start) + content.substr(end);
		var a = preserve[0];
		var b = preserve[1];
		if (!a || !b || (a >= start && b <= end)) {
			return {
				content   : mutated,
				preserved : []
			};
		}
		if (start < a) {
			a = a - (Math.min(a, end) - start);
		}
		if (start < b) {
			b = b - (Math.min(b, end) - start);
		}
		return {
			content   : mutated,
			preserved : [a, b]
		};
	}

	if (TESTS) {
		[

			// 0 1 2 3 4 5 6 7 8 9
			['012[345]6789',   '0126789'  ],

			//   |
			// 0 1 2 3 4 5 6 7 8 9
			['0|12[345]6789',  '0|126789' ],

			//   { }
			//   {   }
			//   {       }
			//   {             }
			//       [     ]
			// 0 1 2 3 4 5 6 7 8 9
			['0{1}2[345]6789', '0{1}26789'],
			['0{12}[345]6789', '0{12}6789'],
			['0{12[34}5]6789', '0{12}6789'],
			['0{12[345]67}89', '0{1267}89'],

			//       |
			//       {   }
			//       {     }
			//       {         }
			//       [     ]
			// 0 1 2 3 4 5 6 7 8 9
			['012{[34}5]6789', '0126789'],
			['012{[345}]6789', '0126789'],
			['012[{345]67}89', '012{67}89'],

			//         |
			//         { }
			//         {   }
			//         {       }
			//       [     ]
			// 0 1 2 3 4 5 6 7 8 9
			['012[3{4}5]6789', '0126789'],
			['012[3{45}]6789', '0126789'],
			['012[3{45]67}89', '012{67}89'],

			//             |
			//             {   }
			//       [     ]
			// 0 1 2 3 4 5 6 7 8 9
			['012[345{]67}89', '012{67}89'],

			//               |
			//               { }
			//       [     ]
			// 0 1 2 3 4 5 6 7 8 9
			['012[345]6{7}89', '0126{7}89']

		].forEach(function (test) {
			var original = readMarkers(test[0]);
			var expected = readMarkers(test[1]);
			var result = remove(
				original.content,
				original.brackets[0],
				original.brackets[1],
				original.braces
			);
			if (result.preserved.toString() !== expected.braces.toString()) {
				console.error(
					'remove() test:',
					'Expected "' + expected.braces.toString()
						+ '", but got "' + result.preserved.toString() + '"'
				);
			}
		});
	}


			/*

			// start < a && end < b
			//   [ ]
			//         {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//       {     }
			// 0 2 3 4 5 6 7 8 9   mutated
			//
			// 1                   removed
			[1, 2, {start:true}],
			[4, 7, {end  :true}],

			// start < a && end > start && end < b
			//   [       ]
			//         {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//   {   }
			// 0 5 6 7 8 9         mutated
			//       { }
			// 1 2 3 4             removed
			[1, 5, {start:true}],
			[4, 7, {end  :true}],

			// start < a && end == b
			//   [           ]
			//         {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//
			// 0 7 8 9             mutated
			//       {     }
			// 1 2 3 4 5 6         removed
			[1, 7, {start:true}],
			[4, 7, {end  :true}],

			// start < a && end > b
			//   [             ]
			//         {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//
			// 0 8 9               mutated
			//       {     }
			// 1 2 3 4 5 6 7       removed
			[1, 9, {start:true}],
			[4, 7, {end  :true}],

			// start == a && end < b
			//         [   ]
			//         {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//         { }
			// 0 1 2 3 6 7 8 9     mutated
			// {   }
			// 4 5                 removed
			[4, 6, {start:true}],
			[4, 7, {end  :true}],

			// start == a && end == b
			//         [     ]
			//         {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//
			// 0 1 2 3 7 8 9       mutated
			// {     }
			// 4 5 6               removed
			[4, 7, {start:true}],
			[4, 7, {end  :true}],

			// start == a && end > b
			//         [       ]
			//         {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//
			// 0 1 2 3 8 9         mutated
			// {     }
			// 4 5 6 7 8           removed
			[4, 8, {start:true}],
			[4, 7, {end  :true}],

			// start > a && end < b
			//           [ ]
			//         {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//         {   }
			// 0 1 2 3 4 6 7 8 9   mutated
			// {   }
			// 5 6                 removed
			[5, 6, {start:true}],
			[4, 7, {end  :true}],

			// start > a && end == b
			//           [   ]
			//         {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//
			// 0 1 2 3 4 7 8 9     mutated
			//
			// 5 6                 removed
			[5, 7, {start:true}],
			[4, 7, {end  :true}],

			// start > a && end > b
			//           [     ]
			//         {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//         { }
			// 0 1 2 3 4 8 9       mutated
			// {     }
			// 4 5 6 7             removed
			[5, 8, {start:true}],
			[4, 7, {end  :true}],

			// start > a && end > b
			//           [   ]
			//   {     }
			// 0 1 2 3 4 5 6 7 8 9 content
			//   {     }
			// 0 1 2 3 4 7 8 9     mutated
			//
			// 5 6                 removed
			[5, 7, {start:true}],
			[1, 4, {end  :true}]

			*/


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
		return;
		var block = closest(
			Boundaries.container(boundaries[0]),
			Html.hasLinebreakingStyle
		);
		Dom.remove(block.querySelector('br'));
		console.log(block.innerHTML.replace(/\s/g, '·'));

		var yarn = extractFormatting(block);
		var result = extractCollapsed(yarn);

		console.log(result.content);

		yarn = result;
		var offset = 0;
		var str = yarn.content;
		var ranges = yarn.ranges;
		Maps.forEach(ranges, function (range) {
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
