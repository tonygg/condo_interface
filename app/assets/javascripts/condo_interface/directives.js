/**
*	CoTag Condo
*	Direct to cloud resumable uploads
*	
*   Copyright (c) 2012 CoTag Media.
*	
*	@author 	Stephen von Takach <steve@cotag.me>
* 	@copyright  2012 cotag.me
* 
* 	
* 	References:
* 		* https://github.com/umdjs/umd
* 		* https://github.com/addyosmani/jquery-plugin-patterns
*		* http://ie.microsoft.com/testdrive/ieblog/2011/oct/PointerDraw.js.source.html (detect click, touch etc on all platforms)
*		* http://docs.angularjs.org/guide/directive
*		* http://stackoverflow.com/questions/3758606/how-to-convert-byte-size-into-human-readable-format-in-java/3758880
*
**/

(function (factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD
		define(['jquery', 'condo_controller'], factory);
	} else {
		// Browser globals
		factory(jQuery, window.CondoController);
	}
}(function ($, uploads, undefined) {
	'use strict';
	
	
	var safeApply = function(scope, fn) {
		var phase = scope.$root.$$phase;
		if(phase == '$apply' || phase == '$digest') {
			fn();
		} else {
			scope.$apply(fn);
		}
	};
	
	
	//
	// Allow for both mobile and desktop events or both
	//	Overkill?
	//
	var condoInterface = angular.module('CondoInterface', ['CondoUploader'])
	
	
	condoInterface.directive('coTap', function() {
		
		
		//
		// Opera doesn't have Object.keys so we use this wrapper
		//
		var NumberOfKeys = function(theObject) {
			if (Object.keys)
				return Object.keys(theObject).length;
			
			var n = 0;
			for (var key in theObject)
				++n;
			
			return n;
		};
		
		return function(scope, element, attrs) {
			var tracker = {},
			
			// common event handler for the mouse/pointer/touch models and their down/start, move, up/end, and cancel events
			DoEvent = function(event) {
				
				//
				// Optimise rejecting clicks (iOS) that are most likely triggered by a touch
				//
				if (event.originalEvent.type == "click" && NumberOfKeys(tracker) == 0)
					return;
				
				var theEvtObj = event.originalEvent,
					pointerList = theEvtObj.changedTouches ? theEvtObj.changedTouches : [theEvtObj];
				for (var i = 0; i < pointerList.length; ++i) {
					var pointerObj = pointerList[i],
						pointerId = (typeof pointerObj.identifier != 'undefined') ? pointerObj.identifier : (typeof pointerObj.pointerId != 'undefined') ? pointerObj.pointerId : 1;
					 
					if (theEvtObj.type.match(/(start|down)$/i)) {
						// clause for processing MSPointerDown, touchstart, and mousedown
						
						//
						// Track the element the event started on and if we should execute the attached action
						//
						tracker[pointerId] = {element: this, execute: true};
						
						//
						// in the Microsoft pointer model, set the capture for this pointer
						// in the mouse model, set the capture or add a document-level event handlers if this is our first down point
						// nothing is required for the iOS touch model because capture is implied on touchstart
						//
						if (this.msSetPointerCapture)
							this.msSetPointerCapture(pointerId);
						
						
					} else if (theEvtObj.type.match(/move$/i)) {
						// clause handles MSPointerMove and touchmove
						
						if(tracker[pointerId])
							tracker[pointerId].execute = false;
						
						
					} else if (tracker[pointerId] && theEvtObj.type.match(/(up|end|cancel|click)$/i)) {
						// clause handles up/end/cancel/click
						var target = tracker[pointerId].element;
						 
						if (!theEvtObj.type.match(/cancel$/i) && tracker[pointerId].execute === true)
							safeApply(scope, attrs['coTap']);	// Apply the click, touch, point event
						
						delete tracker[pointerId];
						
						//
						// in the Microsoft pointer model, release the capture for this pointer
						// in the mouse model, release the capture or remove document-level event handlers if there are no down points
						// nothing is required for the iOS touch model because capture is implied on touchstart
						//
						if (target.msReleasePointerCapture)
							target.msReleasePointerCapture(pointerId);
					}
				}
			};
 
			if (window.navigator.msPointerEnabled) {
				// Microsoft pointer model
				element.on('MSPointerDown.condo MSPointerMove.condo MSPointerUp.condo MSPointerCancel.condo', DoEvent);
			} else {
				// iOS touch model & mouse model
				element.on('touchstart.condo touchmove.condo touchend.condo touchcancel.condo mousedown.condo click.condo', DoEvent);
			}
			
			
			//
			// Clean up any event handlers
			//
			scope.$on('$destroy', function() {
				element.off('.condo');
			});
			
			
		};
	});
	
	//
	// create a directive for attaching the input events
	//
	condoInterface.directive('coUploads', ['Condo.Broadcast', '$timeout', function(broadcast, $timeout) {
		return {
			controller: 'Condo.Controller',
			link: function(scope, element, attrs) {
				var options = {
					delegate: attrs['coDelegate'] || element,
					drop_targets: attrs['coTargets'] || element,
					hover_class: attrs['coHoverClass'] || 'drag-hover',
					pre_check: attrs['coAccepts'] || '/./i',
					size_limit: attrs['coLimit'] || 0
				},
				
				//
				// Add files with their path information to the system
				//	Queue items here until we decide they should be added to the view
				//
				processPending = function() {
					var avaliable = view_limit - scope.upload_count;
					
					if(avaliable > 0 && pending_items.length > 0) {
						
						var item = pending_items.shift(),
							items = item.items,
							length = items.length;
						
						if(item.folders) {
							var i = 0,
								entry,
								obj,
								count = 0,
								new_items = [],
								processEntry = function(entry, path) {
									//
									// If it is a directory we add it to the pending queue
									//
									try {
										if (entry.isDirectory) {
											entry.createReader().readEntries(function(entries) {
												
												pending_items.push({
													items: entries,
													folders: true,
													path: path + entry.name + '/'
												});
												checkCount();
											});
										} else if (entry.isFile) {			// Files are added to a file queue
											entry.file(function(file) {
												if(path.length > 0)
													file.dir_path = path;
												
												new_items.push(file);
												
												checkCount();
											});
										} else {
											checkCount();
										}
									} catch(err) {
										//
										// TODO:: hmmmm
										//
										checkCount();
									}
		
								},
								checkCount = function() {
									//
									// Counts the entries processed so we can add any files to the queue
									//
									count += 1;
									if (count >= length) {
										if(new_items.length > 0) {
											pending_items.unshift({	// add any files to the start of the queue
												items: new_items,
												folders: false
											});
										}
										safeApply(scope, function() {
											$timeout(processPending);
										});
									}
								};
							
							for (; i < length; i++) {
								
								//
								// first layer of DnD folders require you to getAsEntry
								//
								if(item.path.length == 0) {
									obj = items[i];
									obj.getAsEntry = obj.getAsEntry || obj.webkitGetAsEntry || obj.mozGetAsEntry;
									entry = obj.getAsEntry();
								} else {
									entry = items[i];
								}
								processEntry(entry, item.path);
							}
						} else if(length <= avaliable) {		// Regular files where we can add them all at once
							scope.add(items);
							$timeout(processPending);		// Delay until next tick (delay and invoke apply are optional)
						} else {							// Regular file where we can't add them all at once
							scope.add(items.splice(0, avaliable));
							pending_items.unshift(item);
						}
					}
				},
				view_limit = 50,	// Number of uploads that should be displayed at once
				pending_items = [];	// These are files or folders that have not been processed yet as we are at the view port limit
				
				
				if(!!attrs['coEndpoint'])
					scope.endpoint = attrs['coEndpoint'];
					
				
				scope.options = options;
				scope.remove_completed = false;	// Remove completed uploads automatically	
				
				
				//
				// Determine how to draw the element
				//
				if(document.implementation.hasFeature("org.w3c.svg", "1.0")) {
					element.addClass('supports-svg');
				} else {
					element.addClass('no-svg');
				}
					
					
				//
				// Detect file drops
				//
				options.drop_targets = $(options.drop_targets);
				options.delegate = $(options.delegate).on('drop.condo', options.drop_targets, function(event) {
					options.drop_targets.removeClass(options.hover_class);
					
					//
					// Prevent propagation early (so any errors don't cause unwanted behaviour)
					//
					event.preventDefault();
					event.stopPropagation();
					
					
					if (!!event.originalEvent.dataTransfer.items) {
						pending_items.push({
							items: event.originalEvent.dataTransfer.items,
							folders: true,
							path: ''
						});
					} else if(!!event.originalEvent.dataTransfer.files) {
						var files = event.originalEvent.dataTransfer.files,
							copy = [],
							i = 0;
					
						for (; i < files.length; i += 1)
							copy.push(files[i]);
						
						pending_items.push({
							items: copy,
							folders: false
						});
					}
					
					safeApply(scope, function() {	
						processPending();
					});
				}).on('dragover.condo', options.drop_targets, function(event) {
					$(this).addClass(options.hover_class);
					
					return false;
				}).on('dragleave.condo', options.drop_targets, function(event) {
					$(this).removeClass(options.hover_class);
					
					return false;
				}).
				
				
				//
				// Detect manual file uploads
				//
				on('change.condo', ':file', function(event) {
					var files = $(this)[0].files,
						copy = [],
						i = 0;
					
					for (; i < files.length; i += 1)
						copy.push(files[i]);
						
					$(this).parents('form')[0].reset();
					
					pending_items.push({
						items: copy,
						folders: false
					});
					
					safeApply(scope, function() {
						processPending();
					});
				});
				
				
				//
				// Add new uploads if possible
				//
				scope.$watch('upload_count', function(newValue, oldValue) {
					processPending();
				});
				
				
				//
				// Clean up any event handlers
				//
				scope.$on('$destroy', function() {
					options.drop_targets.off('.condo');
					options.delegate.off('.condo');
					element.removeClass('supports-svg').removeClass('no-svg');
				});
				
				
				scope.$on('coFileAddFailed', function() {
					// TODO:: need an unobtrusive notification system for failed adds
					// alert('Failed to add file: ' + broadcast.message.reason);
				});
				
				
				scope.humanReadableByteCount = function(bytes, si) {
					var unit = si ? 1000.0 : 1024.0;
					if (bytes < unit) return bytes + (si ? ' iB' : ' B');
					var exp = Math.floor(Math.log(bytes) / Math.log(unit)),
						pre = (si ? 'kMGTPE' : 'KMGTPE').charAt(exp-1) + (si ? 'iB' : 'B');
					return (bytes / Math.pow(unit, exp)).toFixed(1) + ' ' + pre;
				}
			}
		}
	}]);
	
	
	//
	// The individual upload events
	//	Triggers the pause, resume, abort functions
	//
	condoInterface.directive('coUpload', function() {
		var PENDING = 0,
			STARTED = 1,
			PAUSED = 2,
			UPLOADING = 3,
			COMPLETED = 4,
			ABORTED = 5;
		
		return function(scope, element, attrs) {
			
			scope.size = scope.humanReadableByteCount(scope.upload.size, false);
			scope.progress = 0;
			scope.paused = true;
			
			scope.$watch('upload.state', function(newValue, oldValue) {
				switch(newValue) {
					case STARTED:
						scope.paused = false;
						scope.upload.message = 'starting...';
						break;
						
					case UPLOADING:
						element.find('div.bar').addClass('animate');
						scope.upload.message = undefined;
						scope.paused = false;
						break;
						
					case COMPLETED:
						scope.upload.message = 'complete';
						element.find('td.controls').replaceWith( '<td class="blank" />' );
						element.find('div.bar').removeClass('animate');
						
						if(scope.remove_completed)
							scope.animate_remove();
						else
							scope.check_autostart();	// Couldn't work out how to put this into the controller
						break;
						
					case PAUSED:
						element.find('div.bar').removeClass('animate');
						if (scope.upload.message === undefined)
							scope.upload.message = 'paused';
							
						scope.paused = true;
						// No need for break
						
						if (scope.ignore_errors && scope.upload.error)
							scope.check_autostart();	// Couldn't work out how to put this into the controller
				}
			});
			
			scope.$watch('upload.progress', function(newValue, oldValue) {
				scope.progress = newValue / scope.upload.size * 100;
			});
						
			
			scope.animate_remove = function() {
				scope.abort(scope.upload);
				
				element.fadeOut(800, function() {
					safeApply(scope, function() {
						scope.remove(scope.upload);
					});
				});
			};
			
		};
	});
	
	
	//
	// Toggling options
	//	based on: https://github.com/angular-ui/bootstrap/tree/master/src/dropdownToggle
	//
	condoInterface.directive('dropdownToggle', ['$document', '$location', '$window', function ($document, $location, $window) {
		var openElement = null, close;
		return {
			restrict: 'CA',
			link: function(scope, element, attrs) {
				scope.$watch(function dropdownTogglePathWatch() {return $location.path();}, function dropdownTogglePathWatchAction() {
					if (close) { close(); }
				});
				
				element.parent().bind('click', function(event) {
					event.stopPropagation();
				});
				
				element.bind('click', function(event) {
					event.preventDefault();
					event.stopPropagation();
					
					var iWasOpen = false;
					
					if (openElement) {
						iWasOpen = openElement === element;
						close();
					}
					
					if (!iWasOpen){
						element.parent().addClass('open');
						openElement = element;
						
						close = function (event) {
							if (event) {
								event.preventDefault();
								event.stopPropagation();
							}
							$document.unbind('click', close);
							element.parent().removeClass('open');
							close = null;
							openElement = null;
						};
						
						$document.bind('click', close);
					}
				});
				
				
				//
				// Center the pop-up, based on CSS location of the button
				//
				var popup = element.next('ul.dropdown-menu');
				popup.css('margin-left', -(popup.width() / 2) + 'px');
			}
		};
	}]);
	
}));