define([
	'dom',
	'keys',
	'html',
	'arrays',
	'editing',
	'boundaries',
	'traversing'
], function (
	Dom,
	Keys,
	Html,
	Arrays,
	Editing,
	Boundaries,
	Traversing
) {
	'use strict';

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

	function create(start, end) {
		var element = Html.parse(
			'<span class="aloha-mention" style="background:whitesmoke;border-radius:10px;"></span>',
			Boundaries.document(start)
		)[0];
		Editing.insert(start, end, element);
		return element;
	}

	var hooks = {};

	var triggers = ['@', '!'];

	function keypress(event) {
		var boundary = event.selection.boundaries[0];
		var elem = Dom.upWhile(
			Boundaries.container(boundary),
			function (node) {
				return !Dom.hasClass(node, 'aloha-mention')
					&& Dom.isEditingHost(node);
			}
		);
		if (Dom.hasClass(elem, 'aloha-mention')) {
			if (hooks.keypress) {
				hooks.keypress(event, elem);
			}
			return event;
		}
		var key = Keys.parseKeys(event.nativeEvent);
		if (!Arrays.contains(triggers, key.chr)) {
			return event;
		}
		var prev = Traversing.prev(boundary, 'visual');
		if (!nextChar(prev).trim()) {
			elem = create(prev, boundary);
			boundary = Boundaries.fromEndOfNode(elem);
			event.selection.boundaries = [boundary, boundary];
			if (hooks.enter) {
				hooks.enter(event, elem, key.chr);
			}
		}
		return event;
	}

	function keydown(event) {
		if (Keys.CODES['enter'] !== event.keycode && Keys.CODES['escape'] !== event.keycode) {
			return event;
		}
		var elem = Dom.upWhile(
			Boundaries.container(event.selection.boundaries[0]),
			Dom.isTextNode
		);
		if (Dom.hasClass(elem, 'aloha-mention')) {
			var boundaries = event.selection.boundaries;
			boundaries = Editing.remove(boundaries[0], boundaries[1]);
			if (Boundaries.isAtEnd(boundaries[0])) {
				var boundary = Boundaries.fromBehindOfNode(elem);
				// prevent default enter behaviour (hackish)
				event.keycode = -1;
				event.selection.boundaries = [boundary, boundary];
				if (hooks.exit) {
					hooks.exit(event, elem);
				}
			} else {
				// TODO split `elem`
			}
		}
		return event;
	}

	var handlers = {
		'keypress' : keypress,
		'keydown'  : keydown
	};

	function handleMentions(event) {
		return handlers[event.type] ? handlers[event.type](event) : event;
	}

	return {
		handleMentions : handleMentions,
		triggers       : triggers,
		hooks          : hooks
	};

});
