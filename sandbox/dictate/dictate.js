define([
	'../../src/aloha'
], function (
	aloha
) {
	'use strict';

	function $(selector, context) {
		return context.querySelectorAll(selector);
	}

	function commonContainer(start, end) {
		return aloha.ranges.fromBoundaries(start, end).commonAncestorContainer;
	}

	// http://www.kaisdukes.com/papers/spatial-ltc2013.pdf */
	// http://en.wikipedia.org/wiki/Brown_Corpus#Part-of-speech_tags_used
	// http://www.link.cs.cmu.edu/link/dict/summarize-links.html

	// We can even use machine learning to train our algorithm using crowdsourcing game-with-a-purpose.
	// We will need to pair editing commands with word-aligned semantic trees.
	// The input is uncontrained--being only bound to english.
	// We will be using a very well defined domain (editing).
	// What about voice strain/
	//
	// There are four types of sentences in the english grammer (declerative,
	// imperative, interrogative, and exlamatory).  To build a instruction
	// system we only need to use the imperative type.

	/* https://dvcs.w3.org/hg/speech-api/raw-file/tip/speechapi.html#dfn-utteranceonend */
	if (!('webkitSpeechRecognition' in window)) {
		console.error('no speech');
		return;
	}

	var timestamp;
	var recognition = new webkitSpeechRecognition();
	recognition.continuous = true;
	recognition.interimResults = true;

	recognition.onstart = function () {
		console.log('speak now');
	};

	recognition.onerror = function (event) {
		if ('no-speech' === event.error) {
			console.error('no speech');
		}
		if ('audio-capture' === event.error) {
			console.error('no microphone');
		}
		if ('not-allowed' == event.error) {
			if (event.timeStamp - timestamp < 100) {
				console.error('blocked');
			} else {
				console.error('denied');
			}
		}
		console.error(event.type);
	};

	recognition.onend = function () {
		console.warn('ending');
		recognition.start();
	};

	function listen(publish) {
		timestamp = +new Date();
		recognition.onresult = function () {
			var results = event.results;
			var result;
			for (var i = event.resultIndex; i < results.length; i++) {
				result = results[i];
				if (result.isFinal) {
					return publish(result[0].transcript, result[0].confidence);
				}
			}
		};
		recognition.start();
	}

	var FORMAT_ACTIONS = {
		'underline-style' : 'format',
		'emphasis'        : 'format',
		'strike'          : 'format',
		'enlarge'         : 'format',
		'shrink'          : 'format',
		'justify'         : 'format',
		'center'          : 'format',
		'right align'     : 'format',
		'left align'      : 'format'
	};

	var SIGNALS = [
		'aloha', 'mahalo'
	];

	var VERBS = [
		'align',
		'enter',
		'insert',
		'emphasis', 'italicize', 'underline-style', 'strike', 'strike-through',
		'delete', 'remove', 'clear', 'erase',
		'cut', 'copy', 'paste',
		'enlarge', 'shrink',
		'undo', 'redo',
		'repeat',
		'dictate',
		'goto', 'move', 'select', 'skip',
		'expand', 'collapse',
		'prepend', 'append',
		'format', 'make'
	];

	var NOUNS = [
		// remove color
		'color',

		// clear fomatting
		'formatting',

		'block',
		'paragraph',
		'sentence',
		'word',
		'character',

		'image',
		'table',
		'list',
		'item',
		'element',
		'header',
		'heading',
		'link',

		'selection',
		'range',
		'boundary',

		'content',
		'editable'
	];

	var formatting = [
		'bold', 'italic', 'underline-style', 'struck-through'
	];

	/**
	 * A map of phrases commonly miss-recognized.
	 */
	var PHRASE_CORRECTIONS = {
		''            : /\b(now|then|let's)\b/,
		'move'        : /\bwho\b/ig,
		'move the'    : /\bmovie\b/ig,
		'move it'     : /\bmoving\b/ig,
		'select'      : /\b(electra|selective)\b/ig,
		'select this' : /\bsylectus\b/ig,
		'selection'   : /\be[lr]ection\b/ig,
		'words'       : /\bworth\b/ig,
		'cut'         : /\b(cause|caught)\b/ig,
		'paste'       : /\btaste\b/ig,
		'insert'      : /\bsearch\b/ig,
		'at the'      : /\bof the\b/ig,
		'current'     : /\bcards\b/ig,
		'delete'      : /\bdenise\b/ig,
		'caret'       : /\bcar\b/ig,
		'make it'     : /\b(making|magen|naked|fake)\b/ig,
		'red'         : /\b(bread|bed)\b/ig,
		'blue'        : /\bboobs\b/ig,
		'color'       : /\bcall in\b/ig,
		'bold'        : /\b(bolt|bald|pole)\b/ig,
		'paragraph'   : /\bparagraph\b/ig,
		'delete it'   : /\bdeleted\b/ig,

		// substitutes for words that are not in the stanford english corpse
		// "make" is a better substitue for "format" than "decorate" is
		'move to $1'       : /^(first|second|third|[a-z]+?th|last|left|right|start|end|beginning|next|previous)\b/ig,
		'the $1'           : /\b(first|second|third|[a-z]+?th|last|left|right|start|end|beginning|next|previous)\b/ig,
		'make'             : /^(format|color)\b/ig,
		'$1-align'         : /\b(right|left) align(ed)?\b/ig,
		' underline-style' : / underlined?\b/ig,
		'paste clipboard'  : /\bpaste\b/ig
	};

	var MISSING_PRONOUN = new RegExp('(' + VERBS.join('|') + ')\\s+(' + NOUNS.join('|') + ')', 'g');

	/**
	 * Normalizes the given utterance by correcting common slurred words.
	 *
	 * @param  {String} speech
	 * @return {String}
	 */
	function normalize(speech) {
		for (var replacement in PHRASE_CORRECTIONS) {
			if (PHRASE_CORRECTIONS.hasOwnProperty(replacement)) {
				speech = speech.replace(PHRASE_CORRECTIONS[replacement], replacement);
			}
		}
		speech = speech.replace(/ the\s+the /g, ' the ')
		               .replace(/ to the\s+to the /, ' to the ')
		               .replace(/ clipboard\s+(from )?(the )?clipboard /, ' clipboard ');
		// insert "the" between verb and subject if pronoun is missing
		return speech.replace(MISSING_PRONOUN, '$1 the $2');
	}

	// https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
	var colors = {
		'black'      : 'black',
		'silver'     : 'silver',
		'gray'       : 'gray',
		'white'      : 'white',
		'maroon'     : 'maroon',
		'red'        : 'red',
		'purple'     : 'purple',
		'fuchsia'    : 'fuchsia',
		'green'      : 'green',
		'lime'       : 'lime',
		'olive'      : 'olive',
		'yellow'     : 'yellow',
		'navy'       : 'navy',
		'blue'       : 'blue',
		'teal'       : 'teal',
		'aqua'       : 'aqua',
		'orange'     : 'orange',
		'aquamarine' : 'aquamarine',
		'azure'      : 'azure',
		'beige'      : 'beige',
		'brown'      : 'brown',
		'chocolate'  : 'chocolate',
		'coral'      : 'coral',
		'crimson'    : 'crimson',
		'gold'       : 'gold',
		'grey'       : 'grey',
		'indigo'     : 'indigo',
		'ivory'      : 'ivory',
		'khaki'      : 'khaki',
		'lavender'   : 'lavender',
		'pink'       : 'pink',
		'plum'       : 'plum',
		'skyblue'    : 'skyblue',
		'turquoise'  : 'turquoise',
		'violet'     : 'violet'
	};

	var buckets = {
		'color': colors
	};

	function isAdjective(phrase) {
		return !!phrase.ADJP;
	}

	function isAdverb(phrase) {
		return !!phrase.ADVP;
	}

	function isPreposition(phrase) {
		return !!phrase.PP;
	}

	function isNoun(phrase) {
		return !!phrase.NP;
	}

	function getBucket(noun) {
		noun = noun.replace('the ', '');
		switch (noun) {
		// indefinite pronoun
		case 'color': 
			return buckets.color;

		// subject pronoun
		default:
			return null;
		}
	}

	/**
	 * Given a verb phrase object, determine what action name (and perhaps
	 * object) of the imperative are.
	 *
	 * @param  {Object} phrase
	 * @return {Object} action
	 */
	function extractAction(phrase) {
		var action = phrase[0]['#text'];
		if (FORMAT_ACTIONS[action]) {
			// Because format actions require an object
			// eg: action: format, object: red, subject: word
			return {
				action: FORMAT_ACTIONS[action],
				object: action
			};
		}
		return {
			action: action
		};
	}

	function extractNoun(phrases) {
		for (var i = 0; i < phrases.length; i++) {
			if (!isNoun(phrases[i])) {
				continue;
			}
			var noun = PARTS.NP(phrases[i]);
			if (i + 1 === phrases.length || !isAdjective(phrases[i + 1])) {
				return noun;
			}
			// which `noun`
			var bucket = getBucket(noun);
			if (bucket) {
				var adj = PARTS.ADJP(phrases[i + 1]);
				return noun + ':' + adj;
			}
			return noun;
		}
	}

	function extractPreposition(phrases) {
		for (var i = 0; i < phrases.length; i++) {
			if (isPreposition(phrases[i])) {
				return PARTS.PP(phrases[i]);
			}
		}
	}

	function extractAdjective(phrases) {
		for (var i = 0; i < phrases.length; i++) {
			if (isAdjective(phrases[i])) {
				return PARTS.ADJP(phrases[i]);
			}
		}
	}

	function adjective(phrase) {
		return phrase.ADJP[0]['#text'];
	}

	function adverb(phrase) {
		return phrase.ADVP[0]['#text'];
	}

	function noun(phrase) {
		var nouns = [];
		var ads = [];
		var conjunctions = phrase.NP;
		for (var i = 0; i < conjunctions.length; i++) {
			if (isAdjective(conjunctions[i])) {
				ads.push(PARTS.ADJP(conjunctions[i]));
			} else if (isAdverb(conjunctions[i])) {
				ads.push(PARTS.ADVP(conjunctions[i]));
			} else {
				nouns.push(conjunctions[i]['#text']);
			}
		}
		nouns = nouns.join('');
		ads = ads.join('');
		var ret = nouns;
		if (nouns && ads) {
			return nouns + ':' + ads;
		}
		return nouns;
	}

	// http://www.chompchomp.com/terms/prepositionalphrase.htm
	//
	// form =  preposition  +               +  noun|pronoun|gerund|clause
	// form = [preposition] + [modifier(s)] + [noun|pronoun|gerund|clause]
	//
	// pronoun (reference) = he, it, they, them, those, that
	// http://www.chompchomp.com/terms/pronounreference.htm
	//
	// answers the question "which one"
	// will never contain the subject
	function preposition(phrase) {
		var parts = phrase.PP;
		var head = parts[0]['#text'];
		var constituents = parts.slice(1);
		var object = extractNoun(constituents);
		// "forwards"
		if (!object) {
			return head;
		}
		return object;
	}

	function sentence(phrase) {
		return compose(phrase.S);
	}

	/**
	 * Extracts action, subject, and (optional) object.
	 * do(action) -> to(subject) * object?
	 *
	 * http://www.chompchomp.com/terms/verbphrase.htm
	 * https://en.wikipedia.org/wiki/Verb_phrase
	 * https://en.wikipedia.org/wiki/Linguistic_typology
	 *
	 * delete -> word
	 * [VP delete [NP selection NP] VP]
	 *
	 * format -> selection * bold
	 * [VP paint [NP the selection NP] [PP with [NP the color NP] [ADJP red ADJP] PP] VP]
	 *
	 * process("add squares to words")
	 * [S [VP add [NP squares NP] [PP to [NP words NP] PP] VP] S] 
	 */
	function verb(phrase) {
		var parts = phrase.VP;
		var action = extractAction(parts);
		var constituents = parts.slice(1);
		var subject = extractNoun(constituents);
		// Because the subject may be implied (eg:"align to the left")
		if (!subject) {
			subject = 'selection';
		}
		var object = action.object;
		if (!object) {
			object = extractPreposition(constituents);
		}
		if (!object) {
			object = extractAdjective(constituents);
		}
		action = action.action;
		return {
			action  : action,
			subject : subject,
			object  : object
		}
	}

	/**
	 * Parts of speech tags mapped to functions to parse phrases.
	 *
	 * @type {string, function}
	 */
	var PARTS = {
		'ADJP' : adjective,
		'ADVP' : adverb,
		'NP'   : noun,
		'PP'   : preposition,
		'S'    : sentence,
		'VP'   : verb
	};

	/**
	 * A list of parts of speech tags.
	 *
	 * @type {Array.<string>}
	 */
	var TAGS = [

		// adjective phrase:
		// headed (https://en.wikipedia.org/wiki/Head_(linguistics)) by adjective
		// answers the questions
		// What kind? How many? or Which one?
		//
		// yields a qualifier which must used against a noun to determine
		// which exact entity the noun denotes
		'ADJP',

		// adverb phrase:
		'ADVP',

		// noun phrase:
		// https://en.wikipedia.org/wiki/Noun_phrase
		// headed by noun or pronoun
		// functions as subject(s) or object(s) in sentence
		// yields entity like places (boundary positions) or objects
		// (selection), image, paragraph, words
		'NP',

		// prepositional phrase
		// headed by preposition, followed by a noun phrase
		// yields location
		'PP',

		// sentence
		// every sentence must have a verb
		// yields stack of lambdas
		'S',

		// verb phrase:
		// contains verb as head along with complements such as noun phrases or prepositional phrases
		// yields action
		'VP',

		// participle
		'PRT'
	];

	/**
	 * Determine the given part's speech part tag.
	 *
	 * @param  {Object} part
	 * @return {string}
	 */
	function getTag(part) {
		for (var i = 0; i < TAGS.length; i++) {
			if (part.hasOwnProperty(TAGS[i])) {
				return TAGS[i];
			}
		}
	}

	function compose(phrases) {
		for (var i = 0; i < phrases.length; i++) {
			var phrase = phrases[i];
			var tag = getTag(phrase);
			var parse = PARTS[tag];
			if (parse) {
				var command = parse(phrase);
				if (!command.object && i + 1 < phrases.length && phrases[i + 1].hasOwnProperty('#text')) {
					command.object = phrases[i + 1]['#text'];
				}
				return command;
			}
		}
	}


	/**
	 * Given a DOM node, returns its structure in the form of an array of it's
	 * text data.
	 *
	 * @param  {Node} dom
	 * @return {Array}
	 */
	function xmlToArray(dom) {
		if (3 === dom.nodeType) {
			return dom.nodeValue;
		}
		var arr = [];
		if (dom.hasChildNodes()) {
			for (var i = 0, l = dom.childNodes.length; i < l; i++) {
				var item = dom.childNodes.item(i);
				var obj = {};
				obj[item.nodeName] = xmlToArray(item);
				arr.push(obj);
			}
		}
		return arr;
	}

	var tags = '(' + TAGS.join('|') + ')';
	var START_TAGS = new RegExp(' ?\\[' + tags + ' ', 'g');
	var END_TAGS   = new RegExp(' ' + tags + '\\]',   'g');

	/**
	 * Parses the given constituent tree diagram from a string into an array of
	 * data structures that map various parts of speech.
	 *
	 * @param  {string} diagram
	 * @return {Array}
	 */
	function treebank(diagram) {
		var div = document.createElement('div');
		div.innerHTML = diagram.replace(START_TAGS, '<$1>').replace(END_TAGS, '<\/$1>');
		return xmlToArray(div.firstChild);
	}

	var positionalAdj = {
		'first'   : 1,
		'second'  : 2,
		'third'   : 3,
		'fourth'  : 4,
		'fifth'   : 5,
		'sixth'   : 6,
		'seventh' : 7,
		'eigth'   : 8,
		'ninth'   : 9
	};

	function determineOffset(part) {
		if (positionalAdj[part]) {
			var offset = positionalAdj[part];
			return function () {
				return offset;
			};
		}
		switch (part) {
		case 'start':
		case 'beginning':
			return function () {
				return 0;
			};
		case 'end':
			return function (node) {
				return aloha.dom.nodeLength(node);
			}
		}
		return null;
	}

	/**
	 * A list of selectable entities.
	 *
	 * @type {string, function(node):boolean}
	 */
	var SELECTORS = {
		'paragraph' : aloha.html.hasLinebreakingStyle,
		'block'     : aloha.html.hasLinebreakingStyle,
		'heading'   : ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
		'link'      : ['A'],
		'image'     : ['IMG'],
		// First list item in list
		'list'      : function (node) {
			return aloha.html.isListItem(node)
			    && (1 === aloha.dom.prevSiblings(node).filter(aloha.html.isListItem).length);
		},
		'list item' : ['LI'],
		'word'      : 'word',
		'character' : 'char'
	}

	function prevContainer(selector, boundary) {
		var reference = aloha.html.prevNode(boundary);
		return aloha.traversing.nextNonAncestor(reference, false, function (node) {
			return reference !== node && !aloha.html.isGroupContainer(node) && selector(node);
		}, aloha.dom.isEditingHost);
	}

	function nextContainer(selector, boundary) {
		var reference = aloha.html.nextNode(boundary);
		return aloha.traversing.nextNonAncestor(reference, true, function (node) {
			return reference !== node && !aloha.html.isGroupContainer(node) && selector(node);
		}, aloha.dom.isEditingHost);
	}

	function determineSelector(part) {
		var selector = SELECTORS[part];
		var type = typeof selector;
		if ('function' === type || 'string' === type) {
			return selector;
		}
		return function (node) {
			return aloha.arrays.contains(selector, node.nodeName);
		};
	}

	function parsePosition(where, state) {
		where = removeArticle(where).trim();
		var parts = where.split(':');
		if (1 === parts.length) {
			parts = where.split(' ');
		}
		var unit;
		var direction;

		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];
			switch (parts[i]) {
			case 'next':
				direction = 'forward';
				break;
			case 'previous':
				direction = 'backward';
				break;
			default:
				unit = determineSelector(part);
			}
			if (direction && unit) {
				break;
			}
		}

		switch (unit) {
		case 'word':
			return 'backward' === direction
				 ? aloha.html.prev(state.start, 'word')
				 : aloha.html.next(state.end,   'word');
		case 'character':
			return 'backward' === direction
				 ? aloha.html.prev(state.start, 'char')
				 : aloha.html.next(state.end,   'char');
		default:
			var container = 'backward' === direction
						  ? prevContainer(unit, state.start)
						  : nextContainer(unit, state.end);
			if (container) {
				return aloha.boundaries.create(container, 0);
			}
		}
		return 'backward' === direction ? state.start : state.end;
	}

	function removeArticle(subject) {
		return subject.replace(/^(a|the|this|that|those) /, '');
	}

	function selectNode(node) {
		var start;
		var end;
		if (aloha.predicates.isVoidNode(node)) {
			start = aloha.boundaries.fromNode(node); 
			end = aloha.boundaries.create(
				aloha.boundaries.container(start), 
				aloha.boundaries.offset(start) + 1
			);
		} else {
			start = aloha.boundaries.create(node, 0);
			end = aloha.boundaries.fromEndOfNode(node);
		}
		return [start, end];
	}

	function resolveSubject(subject, state) {
		if (state.subject === subject) {
			return state.resolved;
		}
		var selector =  SELECTORS[subject];
		if (selector) {
			return selectNode($(selector, commonContainer(state.start, state.end))[0]);
		}
		switch (subject) {
		case 'next':
			return selectNode(nextContainer(state.resolved.nodeName, state.end));
		case 'previous':
			return selectNode(prevContainer(state.resolved.nodeName, state.start));
		case 'it':
		case 'them':
		case 'them all':
		case 'this':
		case 'that':

		case 'selection':

		default:
			return aloha.boundaries.get();
		}
	}

	var caret = document.querySelector('.aloha-caret');
	aloha.dom.addClass(caret, 'aloha-caret-blink');


	/**
	 * Moves `subject` to `where`.
	 */
	function move(subject, where, state) {
		if (!subject) {
			console.error('nothing to move');
		}
		if (!where) {
			console.error('no where to move');
		}
		subject = removeArticle(subject).trim();
		if ('selection' !== subject) {
			console.warn('subject "' + subject + '" not found');
			return;
		}
		var position = parsePosition(where, state);
		state.subject = subject;
		return {
			start : position,
			end   : position
		};
	}

	function determineStyling(style) {
		var formats = {
			'underline-style' : 'underline',
			'emphasis'        : 'italic',
			'italic'          : 'italic',
			'bold'            : 'bold',
		}
		var format = formats[style];
		if (format) {
			return function (start, end) {
				var range = aloha.ranges.fromBoundaries(start, end);
				aloha.editing.format(range, format, true);
			};
		}
		var color = colors[style];
		if (color) {
			return function (start, end) {
				var range = aloha.ranges.fromBoundaries(start, end);
				aloha.editing.format(range, style, true);
				aloha.colors.setTextColor(range, color);
			};
		}
	}

	function make(subject, formatting) {
		subject = removeArticle(subject);
		var boundaries = resolveSubject(subject, state);
		if (!boundaries) {
			console.error('subject "' + subject + '" not found');
			return;
		}

		console.warn(boundaries);
		
		var style = determineStyling(formatting);

		if (!style) {
			console.error('fomatting "' + formatting + '" not supported');
		}

		style(boundaries[0], boundaries[1]);
		aloha.boundaries.select(boundaries[0], boundaries[1]);

		if (!aloha.arrays.contains(['it', 'them', 'them all', 'this', 'that'], subject)) {
			state.subject = subject;
		}
	}

	function _delete(subject) {
		subject = removeArticle(subject);
		var object = resolveSubject(subject, state);
		var boundaries;
		if (object.nodeName) {
			boundaries = [
				aloha.boundaries.fromNode(object),
				aloha.boundaries.fromEndOfNode(object)
			];
		} else {
			boundaries = object;
		}
		var range = aloha.ranges.fromBoundaries(boundaries[0], boundaries[1]);
		var editable = aloha.editables.fromBoundary(aloha.editor, boundaries[0]);
		aloha.boundarymarkers.hint(range);
		aloha.editing.delete(range, editable);
	}

	function select(subject, where) {
		var subject = removeArticle(subject);
		var start = parsePosition(subject, state);
		var end = aloha.boundaries.fromEndOfNode(aloha.boundaries.container(start));
		console.warn(subject);
		console.log(aloha.boundarymarkers.hint([start, end]));
		aloha.boundaries.select(start, end);
		state.subject  = subject;
		state.resolved = [start, end];
	}

	var ACTIONS = {
		'go'     : move,
		'move'   : move,
		'skip'   : move,
		'make'   : make,
		'delete' : _delete,
		'select' : select
	};

	function execute(instruction, state) {
		var action = ACTIONS[instruction.action];
		if (!action) {
			console.error('action "' + instruction.action + '" not supported');
			return state;
		}
		var range = action(instruction.subject, instruction.object, state);
		return {
			start : range.start,
			end   : range.end
		};
	}

	var initialized = false;

	function init() {
		if (initialized) {
			return;
		}

		initialized = true;

		Module.ccall('init', 'number', [], []);

		var parse = Module.cwrap('diagram', 'string', ['string']);

		var process = function (utterance, state) {
			var speech = normalize(utterance);
			var diagram = parse(speech).trim();
			var tree = treebank(diagram);
			var instruction = compose(tree);
			if (!instruction) {
				console.error(utterance, diagram);
				return;
			}
			state = execute(instruction, state);
			console.warn(aloha.boundarymarkers.hint([state.start, state.end]));
			aloha.boundaries.select(state.start, state.end);
			aloha.boundaries.container(state.end).focus();
			return state;
		};

		var editable = document.querySelector('.aloha-editable');
		var state = {
			start : aloha.boundaries.create(editable, 0),
			end   : aloha.boundaries.create(editable, 0)
		};

		window.state = state;
		window.process = process;

		/*
		listen(function (utterance) {
			state = process(utterance, state);
		});
		*/

		var commands = [
			//'move the image to the next paragraph',
			// go to
			/*
			'go to start',
			'go to next paragraph',
			'go to the next paragraph',
			'go to list',  // the first one in the view port
			*/
			'go to next list' /*,
			'go to next image',

			// go
			'go forward',
			'go backwards',

			// skip
			'skip',
			'skip word'//,
			/*
			'skip sentence',
			'skip character',
			'skip over'

			/*
			'move to first paragraph',
			'move to end of sentence',
			'move the selection to the start',
			'move to the next list item',
			'move to the next list item',

			'make this paragraph bold',
			'make it red',
			'make them all underlined',
			'make image smaller',
			'make the next three paragraphs left aligned',

			'paint the selection with the color red',
			'color it green',
			'format this italic',
			'underline this word',

			'align left',
			'align to left',
			'left align',
			'left align the second word',
			'align the second image to the right',

			'delete selection',
			'delete the selection',
			'delete it',
			'delete the next word',

			'select the first image in the second paragraph',

			'copy this image',
			'copy this selection',

			'expand selection forward',

			'paste',
			'paste here',
			'paste from clipboard here'
			*/
		];

		var interval = setInterval(function () {
			if (commands.length) {
				window.state = process(commands.shift(), state);
			} else {
				clearInterval(interval);
			}
		}, 10);

		// process("paste clipboard content at current selection"); //problematic
		// process('select paragraph, and format the selection bold'); // problematic
		// process('select paragraph, and format it bold'); // problematic
		// process('remove formatting'); // problematic
		// process('clear formatting'); // problematic
		// process('erase formatting'); // problematic
	}

	Module.postRun.push(init);
	init();

});
