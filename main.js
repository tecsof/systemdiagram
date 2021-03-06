

function ContinuousForceDirectedLayout() {
    go.ForceDirectedLayout.call(this);
    this._isObserving = false;
  }
  go.Diagram.inherit(ContinuousForceDirectedLayout, go.ForceDirectedLayout);

  ContinuousForceDirectedLayout.prototype.isFixed = function(v) {
    return v.node.isSelected;
  }

  // optimization: reuse the ForceDirectedNetwork rather than re-create it each time
  ContinuousForceDirectedLayout.prototype.doLayout = function(coll) {
    if (!this._isObserving) {
      this._isObserving = true;
      // cacheing the network means we need to recreate it if nodes or links have been added or removed or relinked,
      // so we need to track structural model changes to discard the saved network.
      var lay = this;
      this.diagram.addModelChangedListener(function(e) {
        // modelChanges include a few cases that we don't actually care about, such as
        // "nodeCategory" or "linkToPortId", but we'll go ahead and recreate the network anyway.
        // Also clear the network when replacing the model.
        if (e.modelChange !== "" ||
          (e.change === go.ChangedEvent.Transaction && e.propertyName === "StartingFirstTransaction")) {
          lay.network = null;
        }
      });
    }
    var net = this.network;
    if (net === null) {  // the first time, just create the network as normal
      this.network = net = this.makeNetwork(coll);
    } else {  // but on reuse we need to update the LayoutVertex.bounds for selected nodes
      this.diagram.nodes.each(function(n) {
        var v = net.findVertex(n);
        if (v !== null) v.bounds = n.actualBounds;
      });
    }
    // now perform the normal layout
    go.ForceDirectedLayout.prototype.doLayout.call(this, coll);
    // doLayout normally discards the LayoutNetwork by setting Layout.network to null;
    // here we remember it for next time
    this.network = net;
  }
  // end ContinuousForceDirectedLayout


  
  function init() {

    jQuery("#myDiagramDiv").css("height",window.innerHeight-50);

    if (window.goSamples) goSamples();  // init for these samples -- you don't need to call this
    var $ = go.GraphObject.make;  // for conciseness in defining templates

    myDiagram =
      $(go.Diagram, "myDiagramDiv",  // must name or refer to the DIV HTML element
        {
          "draggingTool.dragsLink": true,
          "draggingTool.isGridSnapEnabled": true,
          "linkingTool.isUnconnectedLinkValid": true,
          "linkingTool.portGravity": 20,
          "relinkingTool.isUnconnectedLinkValid": true,
          "relinkingTool.portGravity": 20,
          "relinkingTool.fromHandleArchetype":
            $(go.Shape, "Diamond", { segmentIndex: 0, cursor: "pointer", desiredSize: new go.Size(8, 8), fill: "tomato", stroke: "darkred" }),
          "relinkingTool.toHandleArchetype":
            $(go.Shape, "Diamond", { segmentIndex: -1, cursor: "pointer", desiredSize: new go.Size(8, 8), fill: "darkred", stroke: "tomato" }),
          "linkReshapingTool.handleArchetype":
            $(go.Shape, "Diamond", { desiredSize: new go.Size(7, 7), fill: "lightblue", stroke: "deepskyblue" }),
          "rotatingTool.handleAngle": 270,
          "rotatingTool.handleDistance": 30,
          "rotatingTool.snapAngleMultiple": 15,
          "rotatingTool.snapAngleEpsilon": 15,
          "undoManager.isEnabled": true,

          initialAutoScale: go.Diagram.Uniform,  // an initial automatic zoom-to-fit
          contentAlignment: go.Spot.Center,  // align document to the center of the viewport
          layout:
            $(ContinuousForceDirectedLayout,  // automatically spread nodes apart while dragging
              { defaultSpringLength: 30, defaultElectricalCharge: 100 }),
        });

      myDiagram.addDiagramListener("BackgroundDoubleClicked",
      function(e) { NodesIndex++; 
          
          var x = 100;
          var y = 100;
          var p = new go.Point(x, y);
          var q = myDiagram.transformViewToDoc(p);


          myDiagram.model.addNodeData({
        key:NodesIndex,text:"Node name",
          loc: go.Point.stringify(q)}); });

    myDiagram.toolManager.draggingTool.doMouseMove = function() {
      go.DraggingTool.prototype.doMouseMove.call(this);
      if(isLocked) return;
      if (this.isActive) { this.diagram.layout.invalidateLayout(); }
    }


    function makePort(name, spot, output, input) {
      // the port is basically just a small transparent circle
      return $(go.Shape, "Circle",
        {
          fill: null,  // not seen, by default; set to a translucent gray by showSmallPorts, defined below
          stroke: null,
          desiredSize: new go.Size(7, 7),
          alignment: spot,  // align the port on the main Shape
          alignmentFocus: spot,  // just inside the Shape
          portId: name,  // declare this object to be a "port"
          fromSpot: spot, toSpot: spot,  // declare where links may connect at this port
          fromLinkable: output, toLinkable: input,  // declare whether the user may draw links to/from here
          cursor: "pointer"  // show a different cursor to indicate potential link point
        });
    }

    var nodeSelectionAdornmentTemplate =
      $(go.Adornment, "Auto",
        $(go.Shape, { fill: null, stroke: "lightgrey", strokeWidth: 1.5, strokeDashArray: [4, 2] }),
        $(go.Placeholder)
      );


    myDiagram.nodeTemplate =
      $(go.Node, "Spot",
        { desiredSize: new go.Size(100, 100) }, 
        { locationSpot: go.Spot.Center },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        { selectable: true, selectionAdornmentTemplate: nodeSelectionAdornmentTemplate },
        new go.Binding("angle").makeTwoWay(),
        // the main object is a Panel that surrounds a TextBlock with a Shape
        $(go.Panel, "Auto",
          { name: "PANEL" },
          new go.Binding("desiredSize", "size", go.Size.parse).makeTwoWay(go.Size.stringify),
          $(go.Shape, "Circle",  // default figure
            {
              portId: "", // the default port: if no spot on link data, use closest side
              fromLinkable: true, toLinkable: true, cursor: "pointer",
              fill: "white",  // default color
              strokeWidth: 2
            },
            new go.Binding("figure"),
            new go.Binding("fill")),
          $(go.TextBlock,
            {
              font: "bold 8pt Helvetica, Arial, sans-serif",
              margin: 4,
              textAlign: "center",
              maxSize: new go.Size(160, NaN),
              wrap: go.TextBlock.WrapFit,
              editable: true
            },
            new go.Binding("text").makeTwoWay())
        )
      );

    function showSmallPorts(node, show) {
      node.ports.each(function(port) {
        if (port.portId !== "") {  // don't change the default port, which is the big shape
          port.fill = show ? "rgba(0,0,0,.3)" : null;
        }
      });
    }

    var linkSelectionAdornmentTemplate =
      $(go.Adornment, "Link",
        $(go.Shape,
          { isPanelMain: true, fill: null, stroke: "deepskyblue", strokeWidth: 0 })  // use selection object's strokeWidth
      );

    myDiagram.linkTemplate =
      $(go.Link,  // the whole link panel
        { selectable: true, selectionAdornmentTemplate: linkSelectionAdornmentTemplate },
        { relinkableFrom: true, relinkableTo: true, reshapable: true },
        {
          curve: go.Link.Bezier
        },
        new go.Binding("points").makeTwoWay(),
        $(go.Shape,  // the link path shape
          { isPanelMain: true, strokeWidth: 2 }),
        $(go.Shape,  // the arrowhead
          { toArrow: "Standard", stroke: null }),
        $(go.Panel, "Auto",
          $(go.Shape, "RoundedRectangle",  // the link shape
            { fill: "#f5f5f5", stroke: "#ccc" }),
          $(go.TextBlock,
            {
              textAlign: "center",
              font: "10pt helvetica, arial, sans-serif",
              stroke: "#919191",
              margin: 2,
              minSize: new go.Size(10, NaN),
              editable: true
            },
            new go.Binding("text").makeTwoWay())
        )
      );

    load();  // load an initial diagram from some JSON text

    myDiagram.addModelChangedListener(function(evt) {
      save();
  });
    
  }


  // Show the diagram's model in JSON format that the user may edit
  function save() {
    saveDiagramProperties();  // do this first, before writing to JSON
    window.localStorage["graphState"] = myDiagram.model.toJson();
    jQuery("#myDump").text(window.localStorage["graphState"]);
  }
  function load() {
    myDiagram.model = go.Model.fromJson(window.localStorage["graphState"] != null ? JSON.parse(window.localStorage["graphState"]) : { "class": "go.GraphLinksModel",
"linkFromPortIdProperty": "fromPort",
"linkToPortIdProperty": "toPort",
"nodeDataArray": [
],
"linkDataArray": [
]});
    loadDiagramProperties();  // do this after the Model.modelData has been brought into memory

    myDiagram.nodes.each(function (n) {
          if(n.data.key>=NodesIndex){NodesIndex=n.data.key;}
      });

  }

  function saveDiagramProperties() {
    myDiagram.model.modelData.position = go.Point.stringify(myDiagram.position);
  }
  function loadDiagramProperties(e) {
    // set Diagram.initialPosition, not Diagram.position, to handle initialization side-effects
    var pos = myDiagram.model.modelData.position;
    if (pos) myDiagram.initialPosition = go.Point.parse(pos);
  }


  function incrementSystem(){
      if(running){
          running=false;
          $("#play").text("PLAY");
          window.clearInterval(globalTimer);
      }
      else{
          
          running=true;
      $("#play").text("PAUSE");
      globalTimer= window.setInterval(function(){
      for(var i=0;i<myDiagram.model.linkDataArray.length;i++){
          var from = myDiagram.model.linkDataArray[i].from;
          var to = myDiagram.model.linkDataArray[i].to;
          var multiplier = myDiagram.model.linkDataArray[i].text!=null && myDiagram.model.linkDataArray[i].text.length>0 ? myDiagram.model.linkDataArray[i].text=="+" ? 1 : myDiagram.model.linkDataArray[i].text=="-" ? -1 : parseFloat(isNaN(myDiagram.model.linkDataArray[i].text.split("(")[0].trim()) ? 1 : myDiagram.model.linkDataArray[i].text.split("(")[0].trim()) : 1;


          console.log(multiplier);
          myDiagram.nodes.each(function (n) {
              if(n.data.key==from){
                  n.scale = (n.scale - (0.001 * (multiplier*n.scale))) < 0 ? 0.001 : n.scale - (0.001 * (multiplier*n.scale));
              }
          });
          myDiagram.nodes.each(function (n) {
              if(n.data.key==to){
                  n.scale = n.scale + (0.001* (multiplier*n.scale));
              }
          });
      }
  },10);
  }

  }

  function rewind(){
      myDiagram.nodes.each(function (n) {
          n.scale = 1;
      });
  }

  function clearGraph(){
      if(confirm("Sure?")){
      window.localStorage.removeItem("graphState");
      load();
  }
  }
  function loadGraph(){
    window.localStorage["graphState"] = jQuery("#myDump").val();
    load();
  }
  function lockGraph(){
    if(isLocked){jQuery("#lock").text("LOCK");isLocked=false;}
    else{jQuery("#lock").text("UNLOCK");isLocked=true;}
  }

  function fitZoom(){
      myDiagram.zoomToRect(myDiagram.documentBounds);
  }

  var NodesIndex = 1;
  var running = false;
  var globalTimer = null;
  var isLocked=false;