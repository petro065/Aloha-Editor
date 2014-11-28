(function (aloha) {
	'use strict';

	var Dom = aloha.dom;
	var Keys = aloha.keys;
	var Html = aloha.html;
	var Editor = aloha.editor;
	var Editing = aloha.editing;
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

	function replace(start, end, replacement) {
		var boundaries = Editing.remove(start, end);
		Editing.insert(boundaries[0], boundaries[1], replacement);
		var boundary = Boundaries.fromEndOfNode(replacement);
		return [boundary, boundary];
	}

	function person(start, end) {
		var element = Html.parse(
			'<span class="aloha-mention" style="background:whitesmoke;border-radius:10px;">@</span>',
			Boundaries.document(start)
		)[0];
		return replace(start, end, element);
	}

	function other(start, end) {
		return [start, end];
	}

	var triggers = {
		'@': person,
		'!': other
	};

	function keypress(event) {
		var key = Keys.parseKeys(event.nativeEvent);
		var trigger = triggers[key.chr];
		if (!trigger) {
			return event;
		}
		var boundary = event.selection.boundaries[0];
		var start = Traversing.prev(boundary, 'visual');
		var prev = Traversing.prev(start, 'visual');
		if (!nextChar(prev).trim()) {
			event.selection.boundaries = trigger(start, boundary);
		}
		return event;
	}

	function keydown(event) {
		if (Keys.CODES['enter'] !== event.keycode) {
			return event;
		}
		var node = Boundaries.container(event.selection.boundaries[0]);
		console.log(node);
		return event;
	}

	var handlers = {
		'keypress' : keypress,
		'keydown'  : keydown
	};

	function handleMentions(event) {
		return handlers[event.type] ? handlers[event.type](event) : event;
	}

	Editor.stack.unshift(handleMentions);

}(window.aloha));
