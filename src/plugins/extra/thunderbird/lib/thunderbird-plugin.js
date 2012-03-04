/**
 * Aloha-Editor adapter for Thunderbird
 * ===
 * Will dynamically load aloha stylesheets which cannot be included inline in
 * the html document.
 */

define([
	'aloha',
	'aloha/jquery',
	'aloha/floatingmenu',
	'css!thunderbird/css/aloha.css'
],
function( Aloha, jQuery, FloatingMenu ) {
	'use strict';

	jQuery(function() {
		jQuery('.alohafy').aloha();
	});

	// Prevents the floating menu from floating out of view
	Aloha.bind( 'aloha-selection-changed', function() {
		setTimeout( function() {
			var pos = FloatingMenu.obj.offset();
			var left = pos.left;
			var top = pos.top;
			var reposition = false;

			if ( top < 0 ) {
				top = 0;
				reposition = true;
			}

			if ( left < 0 ) {
				left = 0;
				reposition = true;
			}

			FloatingMenu.floatTo({ top: top, left: left });
		}, 100 );
	});
});
