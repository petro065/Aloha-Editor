(function () {
	'use strict';

	var canvas = document.createElement('div');
	var output = document.createElement('div');
	var status = document.createElement('div');
	var progress = document.createElement('div');

	var Module = {

		preRun: [],
		postRun: [],

		print: (function () {
			var element = output;
			element.value = ''; // clear browser cache
			return function (text) {
				text = Array.prototype.slice.call(arguments).join(' ');
				// These replacements are necessary if you render to raw HTML
				//text = text.replace(/&/g, "&amp;");
				//text = text.replace(/</g, "&lt;");
				//text = text.replace(/>/g, "&gt;");
				//text = text.replace('\n', '<br>', 'g');
				element.value += text + "\n";
				element.scrollTop = element.scrollHeight; // focus on bottom
			};
		})(),

		printErr: function (text) {
			text = Array.prototype.slice.call(arguments).join(' ');
			if (0) { // XXX disabled for safety typeof dump == 'function') {
				dump(text + '\n'); // fast, straight to the real console
			} else {
				console.log(text);
			}
		},

		canvas: canvas,

		setStatus: function (text) {
			if (!Module.setStatus.last) Module.setStatus.last = { time: Date.now(), text: '' };
			if (text === Module.setStatus.text) return;
			var m = text.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
			var now = Date.now();
			if (m && now - Date.now() < 30) return; // if this is a progress update, skip it if too soon
			if (m) {
				text = m[1];
				progress.value = parseInt(m[2])*100;
				progress.max = parseInt(m[4])*100;
				progress.hidden = false;
			} else {
				progress.value = null;
				progress.max = null;
				progress.hidden = true;
			}
			status.innerHTML = text;
		},

		totalDependencies: 0,

		monitorRunDependencies: function (left) {
			this.totalDependencies = Math.max(this.totalDependencies, left);
			Module.setStatus(
				left ? 'Preparing... (' + (this.totalDependencies-left) + '/' + this.totalDependencies + ')'
				     : 'All downloads complete.'
			);
		}
	};

	Module.setStatus('Downloading...');

	window.Module = Module;

}());
