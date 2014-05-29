/*jslint browser: true */
/*jslint sub: true */
/*jslint white: true */

(function( $ ){

	'use strict';

// Helpers

	// Test in an object is an instance of jQuery or Zepto.
	function isInstance ( a ) {
		return a instanceof $ || ( $['zepto'] && $['zepto']['isZ'](a) );
	}


// Link types

	function fromPrefix ( target, method ) {

		// If target is a string, a new hidden input will be created.
		if ( typeof target === 'string' && target.indexOf('-inline-') === 0 ) {

			// By default, use the 'html' method.
			this.method = method || 'html';

			// Use jQuery to create the element
			this.el = $( target.replace('-inline-', '') || '<div/>' )[0];

			return true;
		}
	}

	function fromString ( target ) {

		// If the string doesn't begin with '-', which is reserved, add a new hidden input.
		if ( typeof target === 'string' && target.indexOf('-') !== 0 ) {

			this.method = 'val';

			this.el = document.createElement('input');
			this.el.name = target;
			this.el.type = 'hidden';

			return true;
		}
	}

	function fromFunction ( target ) {

		// The target can also be a function, which will be called.
		if ( typeof target === 'function' ) {
			this.target = false;
			this.method = target;

			return true;
		}
	}

	function fromInstance ( target, method ) {

		if ( isInstance( target ) && !method ) {

		// If a jQuery/Zepto input element is provided, but no method is set,
		// the element can assume it needs to respond to 'change'...
			if ( target.is('input, select, textarea') ) {

				// Default to .val if this is an input element.
				this.method = 'val';
				// Set the slider to a new value on change.

				this.target = target.on('change', this.changeHandler);

			} else {

				this.target = target;

				// If no method is set, and we are not auto-binding an input, default to 'html'.
				this.method = 'html';
			}

			return true;
		}
	}

	function fromInstanceMethod ( target, method ) {

		// The method must exist on the element.
		if ( isInstance( target ) &&
			(typeof method === 'function' ||
				(typeof method === 'string' && target[method]))
		) {
			this.method = method;
			this.target = target;

			return true;
		}
	}


// Link Instance

/** @constructor */
	function Link ( entry, update ) {

		if ( typeof entry !== "object" ) {
			throw new Error("(Link) Initialize with an object.");
		}

		if ( !(this instanceof Link) ) {
			return new Link( entry, update );
		}

		var that = this;

		// Forward calls within scope.
		this.changeHandler = function ( changeEvent ) {
			var decodedValue = that.formatInstance.from( $(this).val() );

			// If the value is invalid, stop this event, as well as it's propagation.
			if ( decodedValue === false || isNaN(decodedValue) ) {

				// Reset the value.
				$(this).val(that.lastSetValue);
				return false;
			}

			that.changeHandlerMethod.call( '', changeEvent, decodedValue );
		}

		// Make sure Link isn't called as a function, in which case
		// the 'this' scope would be the window.
		this.init(
			entry['target'] || function(){},
			entry['method'],
			entry['format'] || { 'to': String, 'from': Number },
			update
		);

		// See if this Link needs individual targets based on its usage.
		// If so, return the element that needs to be copied by the
		// implementing interface.
		this.needsClone = function(){
			return this.el || false;
		};

		// Create a new instance.
		this.clone = function( target ){
			return new Link({
				'target': target,
				'method': this.method,
				'format': this.formatInstance
			}, true);
		};
	}

	// Gets arguments from constructor.
	Link.prototype.init = function ( target, method, format, update ) {

		var f = [fromPrefix, fromString, fromFunction, fromInstance, fromInstanceMethod], i = f.length;

		// Create a new Formatter. The constructor accepts 'undefined'.
		this.formatInstance = format;

		// Store the update option.
		this.update = !update;

		// Try all Link types.
		while ( i-- ) {
			if ( f[(f.length-1)-i].call(this, target, method) ) {
				return;
			}
		}

		// Nothing matched, throw error.
		throw new RangeError("(Link) Invalid Link.");
	};

	// Provides external items with the slider value.
	Link.prototype.set = function ( value, update ) {

		// Don't synchronize this Link.
		if ( this.update && update === false ) {
			return;
		}

		// Ignore named arguments value and update, so only the passed-on
		// arguments remain.
		var args = Array.prototype.slice.call( arguments ),
			additionalArgs = args.slice(2);

		// Store some values. The actual, numerical value,
		// the formatted value and the parameters for use in 'resetValue'.
		// Slice additionalArgs to break the relation.
		this.lastSetValue = value;

		// Prepend the value to the function arguments.
		additionalArgs.unshift(
			this.formatInstance.to( value )
		);

		// When target is undefined, the target was a function.
		// In that case, provided the slider as the calling scope.
		// Branch between writing to a function or an object.
		( typeof this.method === 'function' ?
			this.method :
			this.target[ this.method ] ).apply( this.target, additionalArgs );
	};


// Developer API

	function LinkAPI () {
		this.items = [];
	}

	LinkAPI.prototype.push = function( item ){
		this.items.push(item);
	};

	LinkAPI.prototype.change = function ( value ) {

		var args = Array.prototype.slice.call( arguments, 1 );
		args.unshift( value, true );

		// Write values to serialization Links.
		// Convert the value to the correct relative representation.
		$(this.items).each(function(){
			this.set.apply(this, args);
		});
	};


// jQuery plugin

	/** @export */
	$.fn.Link = function(){

	var args = Array.prototype.slice.call( arguments ),
		flag = args[0];

		if ( typeof flag === 'string' ) {
			args = args.slice(1);
		} else if ( flag !== false ) {
			flag = null;
		}

		return this.each(function(){

			var that = this, list;

			// Remove all bound items.
			if ( flag === false ) {
				delete this.linkAPI;
				return;
			}

			// If flag is null, use the default provided by the plugin.
			if ( !flag ) {
				flag = that.LinkDefaultFlag;
			}

			// Create a list of API's (if it didn't exist yet);
			if ( !this.linkAPI ) {
				this.linkAPI = [];
			}
			
			// Add an API point.
			if ( !this.linkAPI[flag] ) {
				this.linkAPI[flag] = new LinkAPI();
			}

			// Alias the list.
			list = this.linkAPI[flag];

			// Loop all passed linkInstances.
			$.each(args, function ( ignore, linkInstance ){

				linkInstance = new Link(linkInstance);

				// If the Link requires creation of a new element,
				// create this element and create a new Link instance.
				var targetElement = linkInstance.needsClone(), changeHandler;

				// Clone the old element (which isn't in the DOM).
				if ( targetElement ) {
					targetElement = $( targetElement ).clone();
				}

				//  Request confirmation to get the changehandler.
				changeHandler = that.LinkConfirm.call ( that, flag, targetElement );

				// Clone the Link and configure it.
				if ( targetElement ) {
					linkInstance = linkInstance.clone( targetElement )
				}

				// Set the method to be called when a Link changes.
				linkInstance.changeHandlerMethod = changeHandler;

				// Store the linkInstance in the flagged list.
				list.push( linkInstance );
			});

			// Now that Link have been connected, request an update.
			this.LinkUpdate.call( this, flag );
		});
	};

}( window['jQuery'] || window['Zepto'] ));
