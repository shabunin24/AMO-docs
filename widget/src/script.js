define(['jquery', 'underscore'], function ($, _) {
  var AmoDocs = function () {
    var self = this;

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------
    function apiUrl() {
      return (self.params && self.params.api_url) || 'https://amo-docs.onrender.com';
    }

    function leadId() {
      return self.params && self.params.lead_id;
    }

    function widgetCode() {
      return self.params && self.params.widget_code;
    }

    function $container() {
      return $('.widget-body-' + widgetCode());
    }

    function ajax(method, path, data) {
      var opts = {
        url: apiUrl() + path,
        method: method,
        contentType: 'application/json'
      };
      if (data) opts.data = JSON.stringify(data);
      return $.ajax(opts);
    }

    // -----------------------------------------------------------------
    // Render helpers
    // -----------------------------------------------------------------
    function renderLoading() {
      $container().html(
        '<div class="amd-wrap"><div class="amd-empty">Загрузка…</div></div>'
      );
    }

    function renderError(msg) {
      $container().html(
        '<div class="amd-wrap"><div class="amd-empty amd-error">' + (msg || 'Ошибка') + '</div></div>'
      );
    }

    function renderDocuments(docs) {
      var id = leadId();
      var html = '<div class="amd-wrap">';
      html += '<div class="amd-header">';
      html += '<span class="amd-title">Документы (' + docs.length + ')</span>';
      html += '<button class="amd-btn amd-btn-primary amd-create" data-lead="' + id + '">+ Создать</button>';
      html += '</div>';

      if (docs.length === 0) {
        html += '<div class="amd-empty">Нет документов. Нажмите «+ Создать».</div>';
      } else {
        html += '<ul class="amd-list">';
        docs.forEach(function (doc) {
          var date = new Date(doc.created_at).toLocaleDateString('ru-RU');
          html += '<li class="amd-item">';
          html += '<span class="amd-icon">📄</span>';
          html += '<span class="amd-name" title="' + doc.template_name + '">' + doc.template_name + '</span>';
          html += '<span class="amd-date">' + date + '</span>';
          html += '<a class="amd-dl" data-doc="' + doc.id + '" href="#">⬇ Скачать</a>';
          html += '</li>';
        });
        html += '</ul>';
      }

      html += '</div>';
      $container().html(html);
    }

    // -----------------------------------------------------------------
    // Modal
    // -----------------------------------------------------------------
    function removeModal() {
      $('#amd-modal').remove();
      $(document).off('.amd-modal');
    }

    function renderModal(templates) {
      removeModal();
      var id = leadId();

      var html = '<div id="amd-modal" class="amd-overlay">';
      html += '<div class="amd-modal">';
      html += '<div class="amd-modal-head">';
      html += '<span>Создать документ</span>';
      html += '<button class="amd-modal-close">✕</button>';
      html += '</div>';
      html += '<div class="amd-modal-body">';

      if (!templates || templates.length === 0) {
        html += '<div class="amd-empty">Шаблоны не загружены.<br>Загрузите .docx шаблон через API:<br>';
        html += '<code>POST ' + apiUrl() + '/api/v1/templates</code></div>';
      } else {
        html += '<ul class="amd-tpl-list">';
        templates.forEach(function (tpl) {
          html += '<li class="amd-tpl-item">';
          html += '<span class="amd-icon">📋</span>';
          html += '<span class="amd-tpl-name">' + tpl.name + '</span>';
          html += '<button class="amd-btn amd-btn-success amd-gen" data-tpl="' + tpl.id + '" data-lead="' + id + '">Создать</button>';
          html += '</li>';
        });
        html += '</ul>';
      }

      html += '</div></div></div>';
      $('body').append(html);

      // Close on overlay click or × button
      $(document).on('click.amd-modal', '.amd-overlay, .amd-modal-close', function (e) {
        if ($(e.target).hasClass('amd-overlay') || $(e.target).hasClass('amd-modal-close')) {
          removeModal();
        }
      });

      // Generate document
      $(document).on('click.amd-modal', '.amd-gen', function () {
        var $btn = $(this);
        var tplId = $btn.data('tpl');
        var lId = $btn.data('lead');

        $btn.text('Создаю…').prop('disabled', true);

        ajax('POST', '/api/v1/templates/' + tplId + '/generate', { leadId: lId })
          .done(function (data) {
            removeModal();
            // Reload documents list
            self.callbacks.render.call(self);
            // Auto-download
            window.open(apiUrl() + '/api/v1/templates/documents/' + data.document.id + '/download', '_blank');
          })
          .fail(function (xhr) {
            var msg = (xhr.responseJSON && xhr.responseJSON.message) || 'Ошибка создания документа';
            $btn.text('Создать').prop('disabled', false);
            alert(msg);
          });
      });
    }

    // -----------------------------------------------------------------
    // Widget callbacks
    // -----------------------------------------------------------------
    this.callbacks = {

      settings: function () {
        return true;
      },

      init: function () {
        return true;
      },

      render: function () {
        var id = leadId();
        if (!id) return true;

        renderLoading();

        ajax('GET', '/api/v1/templates/documents/lead/' + id)
          .done(function (data) {
            renderDocuments(data.items || []);
          })
          .fail(function () {
            renderError('Не удалось загрузить документы');
          });

        return true;
      },

      bind_actions: function () {
        // Create button
        $(document).on('click', '.amd-create', function () {
          ajax('GET', '/api/v1/templates')
            .done(function (data) {
              renderModal(data.items || []);
            })
            .fail(function () {
              alert('Не удалось загрузить список шаблонов');
            });
        });

        // Download button
        $(document).on('click', '.amd-dl', function (e) {
          e.preventDefault();
          var docId = $(this).data('doc');
          window.open(apiUrl() + '/api/v1/templates/documents/' + docId + '/download', '_blank');
        });

        return true;
      },

      destroy: function () {
        $(document).off('click', '.amd-create');
        $(document).off('click', '.amd-dl');
        removeModal();
        return true;
      },

      onSave: function () {
        return true;
      }
    };

    return this;
  };

  return AmoDocs;
});
