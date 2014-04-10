// http://codebeautify.org/htmlviewer
(function (aloha, $) {
	'use strict';

	module('transform');

	var Dom = aloha.dom;
	var Html = aloha.html;
	var Transform = aloha.transform;
	var WHITESPACE = /(^[\t\r\n ]+)|([\t\r\n ]+$)/g;

	/**
	 * Removes trailing white spaces from DOM tree recursively.
	 *
	 * @param  {Node} node
	 * @return {Node}
	 */
	function trim(node) {
		if (Dom.isTextNode(node)) {
			node.data = node.data.replace(WHITESPACE, '');
		} else {
			Dom.children(node).forEach(trim);
		}
		return node;
	}

	/**
	 * Runs a ms-word tranformation test on the given content.
	 *
	 * @param {string} content
	 */
	function run(content) {
		$('<div>' + content + '</div>').find('>.test').each(function () {
			var $test = $(this);
			var input = trim($test.find('>.input')[0]).innerHTML.trim();
			var expected = trim($test.find('>.expected')[0]).innerHTML.trim();
			var actual = Transform.html(Transform.msword(input, document), document);
			equal(actual, expected, input + ' ⇒ ' + expected);
			// For debugging
			/*
			$('body')
				.append('======= input:\n\n\n\n\n\n\n\n\n\n\n\n\n')
				.append(input)
				.append('======= expected: \n\n\n\n\n\n\n\n\n\n\n\n\n')
				.append(expected)
				.append('======= actual: \n\n\n\n\n\n\n\n\n\n\n\n\n')
				.append(actual)
				.append('<hr>');
			*/
		});
	}

	/**
	 * Run `total` number of tests in the given directory.
	 *
	 * @param {string} directory
	 * @param {number} total
	 */
	function runTests(directory, total) {
		test(directory, function () {
			var path = 'transform/ms-word/' + directory + '/';
			var i;
			for (i = 5; i <= 5; i++) {
				$.ajax({
					url: path + (i < 10 ? '0' : '') + i + '.html',
					async: false,
					success: function (x) { setTimeout(run(x), 10) }
				});
			}
		});
	}

	/*
	runTests('lists',     16);
	runTests('headings',   4);
	runTests('tables',     3);
	*/
	runTests('paragraphs', 8);
	/*
	runTests('toc',        3);
	*/

}(window.aloha, window.jQuery));
