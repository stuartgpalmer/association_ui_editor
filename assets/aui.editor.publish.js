(function($, Symphony) {
	'use strict';

	Symphony.Language.add({
		'Edit': false,
		'Associated {$section-name}': false,
		'You just closed “{$title}” with unsaved changes.': false,
		'Reopen to save?': false,
		'Or dismiss?': false,
		'You just edited “{$title}”.': false,
		'Reopen?': false
	});

	Symphony.Extensions.AssociationUIEditor = function() {
		var fields,
			templateTrigger, templateEditor, templateCreate,
			editors = {};

		var init = function() {
			fields = Symphony.Elements.contents.find('.field[data-editor^="aui-editor"]');
			templateTrigger = createTriggerTemplate();
			templateEditor = createEditorTemplate();
			templateCreate = createNewTemplate();

			attachEditor();
			createNew();
		};

		var createTriggerTemplate = function() {
			return $('<a class="aui-editor-trigger">' + Symphony.Language.get('Edit') + '</a>');
		};

		var createEditorTemplate = function() {
			return $('<div class="aui-editor"><div class="aui-editor-page"><iframe class="is-hidden" width="100%" height="100%" frameborder="0" /></div></div>');
		};

		var createNewTemplate = function() {
			return $('<div class="aui-editor-create"><button class="aui-editor-button">' + Symphony.Language.get('Create New') + '</button></div>');
		};

		var createNew = function() {
			fields.each(attachCreateButton);
		};

		var attachCreateButton = function() {
			var field = $(this),
				button, handle, link;

			if(field.is('[data-editor="aui-editor-new"]')) {
				button = templateCreate.clone();
				handle = getSectionHandle(field.data('parent-section-id'));
				link = Symphony.Context.get('symphony') + '/publish/' + handle + '/new/';

				button.on('click.aui-editor', function(event) {
					event.stopPropagation();
					event.preventDefault();
	
					loadEditor(link);
				}).appendTo(field);
			}
		};

		var attachEditor = function() {
			fields.each(attachTrigger);
		};

		var attachTrigger = function() {
			var item = $(this).find('.item'),
				trigger = templateTrigger.clone();

			trigger.on('mousedown.aui-editor', triggerPage);
			item.not('.aui-editor-trigger').prepend(trigger);				
		};

		var triggerPage = function(event) {
			var link = $(this).parent().data('link');

			event.preventDefault();
			event.stopPropagation();

			if(editors[link]) {
				showEditor(link);
			}
			else {
				loadEditor(link);
			}
		};

		var loadEditor = function(link) {
			var editor = templateEditor.clone();

			// Prepare page
			editor.find('iframe').attr('src', link).on('load.aui-editor', loadPage);

			// Prepare editor closing
			editor.on('click.aui-editor', closeEditor);

			// Attach editor
			editor.data('link', link);
			editors[link] = editor;
			showEditor(link);
		};

		var closeEditor = function() {
			var editor = $(this),
				link;

			if(!editor.is('.aui-editor')) {
				editor = Symphony.Elements.contents.find('.aui-editor:visible');
			}

			link = editor.data('link');
			editor.addClass('is-canceled');
			resetScrollHeight();

			// Hide wrapper
			setTimeout(function() {
				editor.addClass('is-hidden');
			}, 500);

			// Prepare undo
			prepareUndo(link);

			// Trigger update
			$('.field .item[data-link="' + link + '"]').trigger('update');
		};

		var loadPage = function() {
			var iframe = $(this),
				editor = iframe.parents('.aui-editor'),
				contents = iframe.contents(),
				wrapper = contents.find('#wrapper'),
				header = contents.find('#header'),
				notifier = header.find('.notifier'),
				context = contents.find('#context'),
				breadcrumbs = contents.find('#breadcrumbs'),
				content = contents.find('#contents'),
				form = contents.find('#contents form'),
				title = contents.find('#symphony-subheading').text(),
				link = editor.data('link'),
				close, height;

			// Store title
			editor.data('title', title);

			// Modify header links
			close = $('<a />', {
				class: 'aui-editor-close',
				html: Symphony.Language.get('Close') + ' <span>×</span>',
				on: {
					click: closeEditor
				}
			});
			breadcrumbs.after(close);
			breadcrumbs.find('a').each(modifyHeader);

			// Relocate notifications
			notifier.find('p').not('.success').not('.error').remove();
			notifier.find('a').remove();
			if(!notifier.find('p').length) {
				notifier.hide();
			}
			context.after(notifier);

			// Remove elements
			contents.find('body').addClass('aui-editor-section');
			header.remove();
			context.find('.actions').remove();
			content.find('.actions .delete').remove();

			// Show content
			iframe.removeClass('is-hidden');

			// Store state
			editor.data('form', form.serialize());

			// Set height
			height = wrapper.height();
			editor.data('height', height);
			setScrollHeight(link);

			// Prepare saving
			content.find('.actions input[type="submit"]').on('click', function() {
				$('html, body').animate({
					scrollTop: 0
				});
			});
		};

		var modifyHeader = function(index) {
			var link = $(this);

			// Remove internal links
			link.removeAttr('href');

			// Set title
			if(index === 0) {
				link.text(Symphony.Language.get('Associated {$section-name}', {
					'section-name': link.text()
				}));
			}
		};

		var showEditor = function(link) {
			var editor = editors[link],
				iframe, contents, notifier;

			if(editor.is('.is-hidden')) {
				iframe = editor.find('iframe');
				contents = iframe.contents();
				notifier = contents.find('.notifier').hide();
				notifier.find('p').remove();

				editor.removeClass('is-hidden');
				editor.removeClass('is-canceled');
				setScrollHeight(link);
			}
			else {
				Symphony.Elements.contents.append(editor);
			}

			// Set close action
			Symphony.Elements.context.one('click.aui-editor', closeEditor);
			
			// Remove existing undo options
			Symphony.Elements.header.find('.notifier .undo').trigger('detach.notify');
		};

		var prepareUndo = function(link) {
			var id = new Date().getTime(),
				editor = editors[link],
				title = editor.data('title'),
				notifier = Symphony.Elements.header.find('div.notifier'),
				iframe = editor.find('iframe'),
				contents = iframe.contents(),
				form = contents.find('#contents form');

			// Unsaved changes
			if(form.serialize() != editor.data('form')) {
				notifier.trigger('attach.notify', [
					Symphony.Language.get('You just closed “{$title}” with unsaved changes.', {title: title}) + '<a id="' + id + '">' + Symphony.Language.get('Reopen to save?') + '</a>' + '<a id="' + id + '-dismiss">' + Symphony.Language.get('Or dismiss?') + '</a>', 
					'protected error undo'
				]);
			}

			// Closed
			else {
				notifier.trigger('attach.notify', [
					Symphony.Language.get('You just edited “{$title}”.', {title: title}) + '<a id="' + id + '">' + Symphony.Language.get('Reopen?') + '</a>', 
					'protected undo'
				]);
			}

			// Prepare field recovery
			$('#' + id).on('click.aui-editor', function() {
				$(this).parent().trigger('detach.notify');
				showEditor(link);
			});

			// Dismiss
			$('#' + id + '-dismiss').on('click.aui-editor', function() {
				$(this).parent().trigger('detach.notify');
				editor.remove();
				delete editors[link];
			});
		};

		var setScrollHeight = function(link) {
			var editor = editors[link],
				height = editor.data('height');

			Symphony.Elements.contents.css({
				minHeight: height,
				maxHeight: height,
				overflow: 'hidden'
			});
		};

		var resetScrollHeight = function() {
			Symphony.Elements.contents.removeAttr('style');
		};

		var getSectionHandle = function(id) {
			var associations = Symphony.Context.get('env').associations.parent,
				handle = '';

			console.log(id)

			$.each(associations, function(index, association) {
				console.log(association);
				if(association.id == id) {
					handle = association.handle
				}
			});

			return handle;
		};

		// API
		return {
			init: init
		};
	}();

	$(window).on('load.aui-editor', function() {
		Symphony.Extensions.AssociationUIEditor.init();
	});

})(window.jQuery, window.Symphony);
