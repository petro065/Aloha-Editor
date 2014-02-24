define([
	'../../src/aloha'
], function (
	aloha
) {
	'use strict';

	function $(selector, context) {
		return context.querySelectorAll(selector);
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

	var formatActions = {
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

	var signals = [
		'aloha', 'mahalo'
	];

	var verbs = [
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
		'goto', 'move', 'select',
		'expand', 'collapse',
		'prepend', 'append',
		'format', 'make'
	];

	var nouns = [
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

	var corrections = {
		// for slurred speech
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
		'make'             : /^(format|color)\b/ig,
		'$1-align'         : /\b(right|left) align(ed)?\b/ig,
		' underline-style' : / underlined?\b/ig,
		' to the $1'       : / (left|right|start|end|beginning)\b/ig,
		' the $1'          : /\b(first|second|third|[a-z]+?th)\b/ig,
		'paste clipboard'  : /\bpaste\b/ig
	};

	var MISSING_PRONOUN = new RegExp('(' + verbs.join('|') + ')\\s+(' + nouns.join('|') + ')', 'g');

	function normalize(speech) {
		for (var replacement in corrections) {
			if (corrections.hasOwnProperty(replacement)) {
				speech = speech.replace(corrections[replacement], replacement);
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

	function extractAction(phrase) {
		var action = phrase[0]['#text'];
		if (formatActions[action]) {
			return {
				action: formatActions[action],
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
			var noun = parts.NP(phrases[i]);
			if (i + 1 === phrases.length || !isAdjective(phrases[i + 1])) {
				return noun;
			}
			// which `noun`
			var bucket = getBucket(noun);
			if (bucket) {
				var adj = parts.ADJP(phrases[i + 1]);
				return noun + ':' + adj;
			}
			return noun;
		}
	}

	function extractPreposition(phrases) {
		for (var i = 0; i < phrases.length; i++) {
			if (isPreposition(phrases[i])) {
				return parts.PP(phrases[i]);
			}
		}
	}

	function extractAdjective(phrases) {
		for (var i = 0; i < phrases.length; i++) {
			if (isAdjective(phrases[i])) {
				return parts.ADJP(phrases[i]);
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
				ads.push(parts.ADJP(conjunctions[i]));
			} else if (isAdverb(conjunctions[i])) {
				ads.push(parts.ADVP(conjunctions[i]));
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
		return compose(phrase);
	}

	// http://www.chompchomp.com/terms/verbphrase.htm
	// https://en.wikipedia.org/wiki/Verb_phrase
	// https://en.wikipedia.org/wiki/Linguistic_typology
	//
	// Extracts action, subject, and (optional) object
	//
	// delete -> word
	// [VP delete [NP selection NP] VP]
	//
	// format -> selection * bold
	// [VP paint [NP the selection NP] [PP with [NP the color NP] [ADJP red ADJP] PP] VP]
	//
	// process("add squares to words")
	// [S [VP add [NP squares NP] [PP to [NP words NP] PP] VP] S] 
	//
	// do(action) -> to(subject) * object?
	function verb(phrase) {
		var parts = phrase.VP;
		var action = extractAction(parts);
		var constituents = parts.slice(1);
		var subject = extractNoun(constituents);
		// "align to the left"
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

	var parts = {
		'ADJP' : adjective,
		'ADVP' : adverb,
		'NP'   : noun,
		'PP'   : preposition,
		'S'    : sentence,
		'VP'   : verb
	};

	var tags = [

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
		'VP'
	];

	function getTag(part) {
		for (var i = 0; i < tags.length; i++) {
			if (part.hasOwnProperty(tags[i])) {
				return tags[i];
			}
		}
	}

	function compose(phrases) {
		for (var i = 0; i < phrases.length; i++) {
			var phrase = phrases[i];
			var tag = getTag(phrase);
			var parse = parts[tag];
			if (parse) {
				return parse(phrase);
			}
		}
	}

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

	var TAGS = '(' + tags.join('|') + ')';
	var START_TAGS = new RegExp(' ?\\[' + TAGS + ' ', 'g');
	var END_TAGS   = new RegExp(' ' + TAGS + '\\]',   'g');

	/**
	 * Parse constituent tree diagram
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

	var selectors = {
		'paragraph'  : 'P',
		'heading'    : 'H1,H2,H3,H4,H5,H6',
		'link'       : 'A',
		'image'      : 'IMG',
		'list'       : 'OL,UL',
		'list item'  : 'LI',
		'list items' : 'LI',
		'block'      : 'DIV,P,IMG,H1,H2,H3,H4,H5,H6'
	}

	function determineContainer(part, state) {
		var context = state.context;
		var name = selectors[part];
		return context.querySelector(name);
	}

	function nextContainer(selectors, state) {
		var names = selectors.split(',');
		var boundaries = aloha.boundaries.get();
		if (!boundaries) {
			boundaries = [
				null,
				aloha.boundaries.fromNode(document.body.firstChild)
			];
		}
		var next = aloha.boundaries.nextWhile(boundaries[1], function (boundary) {
			return !aloha.arrays.contains(names, aloha.boundaries.container(boundary).nodeName);
		});
		return aloha.boundaries.container(next);
	}

	function parsePosition(where, state) {
		where = where.replace(/^(the|this|that) /, '');
		var parts = where.split(':');
		if (1 === parts.length) {
			parts = where.split(' ');
		}
		var getContainer;
		var selector;
		var getOffset;

		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];
			if (!getOffset) {
				getOffset = determineOffset(part);
				if (getOffset) {
					continue;
				}
			}
			if (!selector || !getContainer) {
				if ('next' === part) {
					getContainer = nextContainer;
				} else if ('previous' === part) {
					getContainer = prevContainer;
				} else {
					selector = selectors[part];
				}
				if (selector && getContainer) {
					break;
				}
			}
		}

		var container;
		if (selector && !getContainer) {
			container =  $(selector, state.context)[0];
		}

		if (selector && getContainer) {
			container = getContainer(selector, state);
		}

		container = container || state.context;
		var offset = getOffset ? getOffset(state.context) : 0;

		return aloha.boundaries.create(container, offset);
	}

	function determineSubject(subject) {
		subject = subject.replace(/^(the|this|that) /, '');
		return subject;
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
		var selector =  selectors[subject];
		if (selector) {
			return selectNode($(selector, state.context)[0]);
		}
		switch (subject) {
		case 'next':
			return selectNode(nextContainer(state.resolved.nodeName, state));
		case 'previous':
			return selectNode(prevContainer(state.resolved.nodeName, state));
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


	function move(subject, where) {
		if (!subject) {
			console.error('nothing to move');
		}
		if (!where) {
			console.error('no where to move');
		}
		subject = determineSubject(subject);
		if ('selection' !== subject) {
			console.warn('subject "' + subject + '" not found');
			return;
		}
		var position = parsePosition(where, state);
		aloha.selections.show(caret, position);
		aloha.boundaries.select(position);
		state.context = aloha.boundaries.container(position);
		state.subject = subject;
		state.resolved = state.context;
		state.context.focus();
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
		subject = determineSubject(subject);
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
		subject = determineSubject(subject);
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
		var subject = determineSubject(subject);
		var start = parsePosition(subject, state);
		var end = aloha.boundaries.fromEndOfNode(aloha.boundaries.container(start));
		console.warn(subject);
		console.log(aloha.boundarymarkers.hint([start, end]));
		aloha.boundaries.select(start, end);
		state.subject  = subject;
		state.resolved = [start, end];
	}

	var state = {
		resolve : null,
		subject : null,
		start   : null,
		end     : null,
		context : document.querySelector('.aloha-editable')
	};

	var actions = {
		'go'     : move,
		'move'   : move,
		'make'   : make,
		'delete' : _delete,
		'select' : select
	};

	function run(instruction) {
		var action = actions[instruction.action];
		if (!action) {
			console.error('action "' + instruction.action + '" not supported');
			return;
		}
		action(instruction.subject, instruction.object);
	}

	var initialized = false;

	function init() {
		if (initialized) {
			return;
		}

		initialized = true;

		Module.ccall('init', 'number', [], []);

		var parse = Module.cwrap('diagram', 'string', ['string']);

		var process = function (utterance) {
			utterance = normalize(utterance);
			var diagram = parse(utterance).trim();
			var tree = treebank(diagram);
			var instruction = compose(tree);
			console.log(utterance);
			console.log(diagram);
			console.log(instruction);
			console.log('-----------------------------------');
			if (instruction) {
				run(instruction);
			} else {
				console.error(utterance, diagram);
			}
		};

		listen(process);

		var commands = [
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
		];

		/*
		var interval = setInterval(function () {
			if (commands.length) {
				process(commands.shift());
			} else {
				clearInterval(interval);
			}
		}, 10);
		*/

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
