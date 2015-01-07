(function (aloha, $, CodeMirror) {
	'use strict';

	aloha.dom.query('.snippet', document).forEach(function (elem) {
		var code = (elem.textContent || elem.innerText).trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>');
		elem.innerHTML = '';
		CodeMirror(elem, {
			value    : code,
			mode     : aloha.dom.getAttr(elem, 'data-syntax') || 'javascript',
			readOnly : true
		});
		var html = elem.innerHTML
		    .replace(/<span class="cm-operator">&lt;\*<\/span>/g, '<u>')
		    .replace(/<span class="cm-operator">\*&gt;<\/span>/g, '</u>')
		    .replace(/{%/g, '<u>').replace(/%}/g, '</u>');
		var snippetLinksCount = 0;
		elem.innerHTML = html.replace(
			/<span class="cm-operator">&lt;&amp;<\/span>(.*?)<span class="cm-operator">&amp;&gt;<\/span>/g,
			function (match, code) {
				return '<span class="snippet-anchor" data-snippet-link="'
				     + (++snippetLinksCount)
				     + '">' + code + '</span>';
			}
		);
	});

	var $window = $(window);

	var state = {
		offsets  : [],
		viewport : {width: 0, height: 0}
	};

	function onresize() {
		state.offsets = [];
		state.viewport = {
			width  : $window.width(),
			height : $window.height()
		};
		$('header').each(function (i, elem) {
			var $elem = $(elem);
			var offset = $elem.offset().top;
			state.offsets.push([offset, offset + $elem.height(), $elem.find('.bg')]);
		});
	}

	var VENDOR_PREFIX = (function () {
		var elem = document.createElement('div');
		var prefixes = ['', '-webkit-', '-moz-', '-ms-', '-o-'];
		var style = elem.style;
		for (var i = 0; i < prefixes.length; i++) {
			if (style.hasOwnProperty(prefixes[i] + 'transform')) {
				return prefixes[i];
			}
		}
		return '';
	}());

	function findLinks(domain, link) {
		return $(
			'[data-snippet-link="' + domain + '.' + link + '"],' +
			'span[data-snippet-link="' + link + '"]'
		);
	}

	function findLinksFromElement($elem) {
		return findLinks(
			$elem.closest('.snippet').attr('data-snippet-link'),
			$elem.attr('data-snippet-link')
		);
	}

	$(function () {
		$('a.snippet-link').each(function (i, elem) {
			var $elem = $(elem);
			var linkage = $elem.attr('data-snippet-link').split('.');
			var domain = linkage[0];
			var link = linkage[1];
			$elem.hover(function () {
				findLinks(domain, link).addClass('snippet-highlight');
			}, function () {
				findLinks(domain, link).removeClass('snippet-highlight');
			});
		});
		$('span.snippet-anchor').hover(
			function (event) {
				findLinksFromElement($(event.target)
					.closest('.snippet-anchor')).addClass('snippet-highlight');
			},
			function (event) {
				findLinksFromElement($(event.target)
					.closest('.snippet-anchor')).removeClass('snippet-highlight');
			}
		);
		if (0 === $('header .bg').length) {
			return;
		}
		window.requestAnimationFrame(function parallax() {
			var yStart = $window.scrollTop();
			var yEnd = yStart + state.viewport.height;
			state.offsets.forEach(function (offsets) {
				if (offsets[0] < yEnd && offsets[1] > yStart) {
					var position = Math.round(yStart - offsets[0]) / 2;
					offsets[2].css(
						VENDOR_PREFIX + 'transform',
						'translate3d(0, ' + position + 'px, 0)'
					);
				}
			});
			window.requestAnimationFrame(parallax);
		});
	});

	function delayed(fn, delay) {
		var timeout = null;
		return function () {
			if (timeout) {
				clearTimeout(timeout);
			}
			timeout = setTimeout(fn, delay);
		};
	}

	$window.on('resize', delayed(onresize, 50));

	onresize();

}(window.aloha, window.jQuery, window.CodeMirror));
