(function (aloha) {
	'use strict';

	var Fn = aloha.fn;
	var Dom = aloha.dom;
	var Keys = aloha.keys;
	var Html = aloha.html;
	var Lists = aloha.lists;
	var Editor = aloha.editor;
	var Editing = aloha.editing;
	var Strings = aloha.strings;
	var Boundaries = aloha.boundaries;
	var Traversing = aloha.traversing;

	function nextChar(boundary) {
		var node;
		if (Boundaries.isTextBoundary(boundary)) {
			node = Boundaries.container(boundary);
			return node.data.substr(Boundaries.offset(boundary), 1);
		}
		node = Boundaries.nextNode(boundary);
		if (Dom.isTextNode(node)) {
			return node.data.substr(0, 1);
		}
		return '';
	}

	/**
	 * Starting with the given, returns the first node that matches the given
	 * predicate.
	 *
	 * @private
	 * @param  {!Node}                  node
	 * @param  {function(Node):boolean} pred
	 * @return {Node}
	 */
	function nearest(node, pred) {
		return Dom.upWhile(node, function (node) {
			return !pred(node)
			    && !(node.parentNode && Dom.isEditingHost(node.parentNode));
		});
	}

	function isAtStartOfLine(boundary) {
		var node = Boundaries.prevNode(boundary);
		if (Dom.isTextNode(node)) {
			var text = node.data;
			var offset = Boundaries.offset(boundary);
			var prefix = text.substr(0, offset);
			var isVisible = Strings.NOT_SPACE.test(prefix)
			             || Strings.NON_BREAKING_SPACE.test(prefix);
			if (isVisible) {
				return false;
			}
			node = node.previousSibling || node.parentNode;
		}
		var stop = nearest(node, Html.hasLinebreakingStyle);
		if (!Html.hasLinebreakingStyle(stop)) {
			return false;
		}
		var start = Boundaries.fromFrontOfNode(stop);
		var visible = 0;
		Html.walkBetween(start, boundary, function (nodes) {
			visible += nodes.filter(Html.isRendered).length;
		});
		return 0 === visible;
	}

	var triggers = {
		'*': Fn.partial(Lists.format, 'UL'),
		'#': Fn.partial(Lists.format, 'OL')
	};

	function handleAutoList(event) {
		if ('keydown' !== event.type || Keys.CODES['space'] !== event.keycode) {
			return event;
		}
		var boundary = event.selection.boundaries[0];
		var prev = Traversing.prev(boundary, 'visual');
		if (prev && isAtStartOfLine(prev)) {
			var token = nextChar(prev);
			if (triggers[token]) {
				var boundaries = triggers[token](prev, boundary);
				event.selection.boundaries = Editing.remove(
					boundaries[0],
					boundaries[1]
				);
			}
		}
		return event;
	}

	for (var i = 0; i < Editor.stack.length; i++) {
		console.log(Editor.stack[i].name);
	}

	Editor.stack.unshift(handleAutoList);

}(window.aloha));
