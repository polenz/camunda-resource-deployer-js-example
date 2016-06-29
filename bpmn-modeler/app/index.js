var fs = require('fs');

var $ = require('jquery'),
    BpmnModeler = require('bpmn-js/lib/Modeler');

var propertiesPanelModule = require('bpmn-js-properties-panel'),
    resourceDeployer = require('camunda-resource-deployer-js/lib/ResourceDeployer'),
    resourceValidator = require('camunda-resource-deployer-js/lib/ResourceValidator'),
    propertiesProviderModule = require('bpmn-js-properties-panel/lib/provider/camunda'),
    camundaModdleDescriptor = require('camunda-bpmn-moddle/resources/camunda');

var container = $('#js-drop-zone');

var canvas = $('#js-canvas');

var deployer = null;
var validator = null;

var bpmnModeler = new BpmnModeler({
  container: canvas,
  propertiesPanel: {
    parent: '#js-properties-panel'
  },
  additionalModules: [
    propertiesPanelModule,
    propertiesProviderModule
  ],
  moddleExtensions: {
    camunda: camundaModdleDescriptor
  }
});

var newDiagramXML = fs.readFileSync(__dirname + '/../resources/newDiagram.bpmn', 'utf-8');

function createNewDiagram() {
  openDiagram(newDiagramXML);
}

function openDiagram(xml) {

  bpmnModeler.importXML(xml, function(err) {

    if (err) {
      container
        .removeClass('with-diagram')
        .addClass('with-error');

      container.find('.error pre').text(err.message);

      console.error(err);
    } else {
      container
        .removeClass('with-error')
        .addClass('with-diagram');
    }


  });
}

function saveSVG(done) {
  bpmnModeler.saveSVG(done);
}

function saveDiagram(done) {

  bpmnModeler.saveXML({ format: true }, function(err, xml) {
    done(err, xml);
  });
}

function registerFileDrop(container, callback) {

  function handleFileSelect(e) {
    e.stopPropagation();
    e.preventDefault();

    var files = e.dataTransfer.files;

    var file = files[0];

    var reader = new FileReader();

    reader.onload = function(e) {

      var xml = e.target.result;

      callback(xml);
    };

    reader.readAsText(file);
  }

  function handleDragOver(e) {
    e.stopPropagation();
    e.preventDefault();

    e.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  }

  container.get(0).addEventListener('dragover', handleDragOver, false);
  container.get(0).addEventListener('drop', handleFileSelect, false);
}


////// file drag / drop ///////////////////////

// check file api availability
if (!window.FileList || !window.FileReader) {
  window.alert(
    'Looks like you use an older browser that does not support drag and drop. ' +
    'Try using Chrome, Firefox or the Internet Explorer > 10.');
} else {
  registerFileDrop(container, openDiagram);
}

// bootstrap diagram functions

$(document).on('ready', function() {

  $('#js-create-diagram').click(function(e) {
    e.stopPropagation();
    e.preventDefault();

    createNewDiagram();
  });

  var downloadLink = $('#js-download-diagram');
  var downloadSvgLink = $('#js-download-svg');
  var deployLink = $('#js-deploy-resource');
  var validateLink = $('#js-validate-resource');

  $('.buttons a, .buttons button').click(function(e) {
    if (!$(this).is('.active')) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  deployLink.click(function(e) {
    if(deployer) {
      return;
    }

    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('id', 'close');
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', function() {
      $('#js-resource-deployer').toggleClass('active', false);
      deployer.close();
      deployer = null;
    });

    $('#js-resource-deployer').append(closeBtn);

    var filename = bpmnModeler.get('canvas').getRootElement().businessObject.name;
    if(filename) {
      filename += '.bpmn';
    }
    else {
      filename = 'process.bpmn';
    }

    deployer = new resourceDeployer({
      apiUrl: 'http://localhost:8080/engine-rest',
      filename: filename,
      container: $('#js-resource-deployer')[0],
      resourceProvider: function(done) {
        bpmnModeler.saveXML(done);
      }
    });

    $('#js-resource-deployer').toggleClass('active');

  });

  validateLink.click(function(e) {
    if(validator) {
      return;
    }

    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('id', 'close');
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', function() {
      $('#js-resource-validator').toggleClass('active', false);
      validator.close();
      validator = null;
    });

    $('#js-resource-validator').append(closeBtn);

    validator = new resourceValidator({
      apiUrl: 'http://localhost:8080/engine-rest',
      container: $('#js-resource-validator')[0],
      resourceProvider: function(done) {
        bpmnModeler.saveXML(done);
      }
    });

    $('#js-resource-validator').toggleClass('active');

  });


  function setEncoded(link, name, data) {
    var encodedData = encodeURIComponent(data);

    if (data) {
      link.addClass('active').attr({
        'href': 'data:application/bpmn20-xml;charset=UTF-8,' + encodedData,
        'download': name
      });
    } else {
      link.removeClass('active');
    }
  }

  var debounce = require('lodash/function/debounce');

  var exportArtifacts = debounce(function() {

    saveSVG(function(err, svg) {
      setEncoded(downloadSvgLink, 'diagram.svg', err ? null : svg);
    });

    saveDiagram(function(err, xml) {
      setEncoded(downloadLink, 'diagram.bpmn', err ? null : xml);
    });

    deployLink.addClass('active');

    validateLink.addClass('active');
  }, 500);

  bpmnModeler.on('commandStack.changed', exportArtifacts);
});
