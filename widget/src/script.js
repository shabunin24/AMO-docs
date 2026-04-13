// Только jquery: зависимость от underscore ломала инициализацию, если модуль недоступен в require amo.
define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------
    function apiUrl() {
      var raw =
        (self.params && self.params.api_url) ||
        (self.params && self.params.backend_url) ||
        'https://amo-docs.onrender.com';
      return String(raw).replace(/\/+$/, '');
    }

    function leadId() {
      var p = self.params || {};
      if (p.lead_id != null && p.lead_id !== '') {
        return p.lead_id;
      }
      if (p.id != null && p.id !== '') {
        return p.id;
      }
      try {
        if (typeof APP !== 'undefined' && APP.constant) {
          var cardEl = APP.constant('card_element');
          if (cardEl && cardEl.id) {
            return cardEl.id;
          }
          var fromConst = APP.constant('card_id');
          if (fromConst) {
            return fromConst;
          }
        }
        if (typeof APP !== 'undefined' && APP.data && APP.data.current_card && APP.data.current_card.id) {
          return APP.data.current_card.id;
        }
      } catch (e) {
        /* ignore */
      }
      return null;
    }

    function widgetCode() {
      if (self.params && self.params.widget_code) {
        return self.params.widget_code;
      }
      if (typeof self.get_settings === 'function') {
        try {
          var st = self.get_settings();
          if (st && st.widget_code) {
            return st.widget_code;
          }
        } catch (e2) {
          /* ignore */
        }
      }
      return null;
    }

    // Для lcard-1 amo отрисовывает правую колонку только после render_template().
    // Селектор .widget-body-* без него часто пустой — виджет «молчит», хотя script.js грузится.
    function $container() {
      var code = widgetCode();
      if (!code) {
        return $();
      }
      return $('.amd-widget-root-' + code);
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

    function bindListUiHandlers() {
      var $root = $container();
      if (!$root.length) {
        return;
      }
      $root.off('.amoDocsList');
      $root.on('click.amoDocsList', '.amd-create', function (e) {
        e.preventDefault();
        e.stopPropagation();
        ajax('GET', '/api/v1/templates')
          .done(function (data) {
            renderModal(data.items || []);
          })
          .fail(function () {
            alert('Не удалось загрузить список шаблонов');
          });
      });
      $root.on('click.amoDocsList', '.amd-dl', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var docId = $(this).data('doc');
        window.open(apiUrl() + '/api/v1/templates/documents/' + docId + '/download', '_blank');
      });
    }

    function renderDocuments(docs) {
      var id = leadId();
      var html = '<div class="amd-wrap">';
      html += '<div class="amd-header">';
      html += '<span class="amd-title">Документы (' + docs.length + ')</span>';
      html +=
        '<button type="button" class="amd-btn amd-btn-primary amd-create" data-lead="' +
        id +
        '">+ Создать</button>';
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
      bindListUiHandlers();
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
        var code = widgetCode();
        if (!code) {
          return true;
        }

        if (typeof self.render_template === 'function') {
          var cssHref = (self.params && self.params.path) || '';
          var cssTag = cssHref
            ? '<link rel="stylesheet" type="text/css" href="' + cssHref + '/style.css">'
            : '';
          // По доке amo: при передаче готового HTML в body нужно явно указать render: ''.
          self.render_template({
            caption: {
              class_name: 'amd-widget-caption-' + code,
              html: ''
            },
            body:
              cssTag +
              '<div class="amd-widget-root-' +
              code +
              '"><div class="amd-wrap"><div class="amd-empty">Загрузка…</div></div></div>',
            render: ''
          });
        } else {
          $('.widget-body-' + code).html(
            '<div class="amd-widget-root-' +
              code +
              '"><div class="amd-wrap"><div class="amd-empty">Загрузка…</div></div></div>'
          );
        }

        if (!id) {
          renderError('Не удалось определить ID сделки (обновите страницу).');
          return true;
        }

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
        // Клики вешаются на контейнер в bindListUiHandlers() после render — см. destroy/render.
        return true;
      },

      destroy: function () {
        var c = widgetCode();
        if (c) {
          $('.amd-widget-root-' + c).off('.amoDocsList');
        }
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

  return CustomWidget;
});
