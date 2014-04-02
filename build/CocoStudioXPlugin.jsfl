var CocoStudioXPluginPath = fl.configURI + "WindowSWF/CocoStudioXPlugin"; 

fl.runScript( CocoStudioXPluginPath + "/JSON.jsfl" );

var csx = {};

(function(){ 
    
    // 
    var TEMP_ITEM_NAME = "CocoStudioXTemp";

    var EXPORT_PATH = "exportPath";


    // init configuration
//     var Config = {};
// 
//     (function(){
//         var configXML;
// 
//         var configPath = CocoStudioXPluginPath + '/config.xml';
// 
//         if(FLfile.exists(configPath)){
//             var str = FLfile.read(configPath);
//             configXML = new XML(str);
//         }else{
//             configXML = <config />;
//         }
//         fl.trace(configXML);
// 
//         function saveConfig(){
//             FLfile.write(configPath, configXML);
//         }
// 
//         Config.ExportPath = {
//             get:function(){
//                 return configXML[EXPORT_PATH];
//             },
//             set:function(path){
//                 configXML.@EXPORT_PATH = path;
//                 fl.trace(configXML[EXPORT_PATH]);
//                 saveConfig();
//             }
//         }
// 
//         
//         
//     })();



    var dom;
    var lib;
    var tempItem;


    var currentItem;
    var currentTimeline;
    var currentLayer;
    var currentFrame;
    var lastFrame;

    var lastNode;

    var projectName;
    var exportPath;
    
    //////////////////////////////////////////////////////////////////////////////////////////////
    // export struct
    function AnimationElement(){
        this.node   = new Node;
        this.action = new Action;

        this.node.nodeType   = "Node";
    }

    function Node(){
        this.name       = "";
        this.nodeType   = "";
        this.actionTag  = 0;
        this.children   = [];
    }

    function Action(){
        this.duration   = 0;
        this.speed      = 1;
        this.timelines  = [];
    }

    var FrameType = {
        VISIBLE:        "VisibleFrame",
        POSITION:       "PositionFrame",
        SCALE:          "ScaleFrame",
        ROTATION:       "RotationFrame",
        SKEW:           "RotationSkewFrame",
        COLOR:          "ColorFrame",
        ANCHOR:         "AnchorFrame",
        INNER_ACTION:   "InnerActionFrame",
        Color:          "ColorFrame"
    }

    function Timeline(frameType){
        this.frameType  = frameType;
        this.actionTag  = 0;
        this.frames     = [];
    }


    function VisibleFrame(frameIndex, visible){
        this.frameIndex = frameIndex;
        this.visible    = visible;
    }

    function PositionFrame(frameIndex, tween, x, y){
        this.frameIndex = frameIndex;
        this.tween = tween;

        this.x = x;
        this.y = y;

        this.applyNode = function(node){
            node.x = this.x;
            node.y = this.y;
        }
    }

    function ScaleFrame(frameIndex, tween, scalex, scaley){
        this.frameIndex = frameIndex;
        this.tween = tween;

        this.scalex = scalex;
        this.scaley = scaley;

        this.applyNode = function(node){
            node.scalex = this.scalex;
            node.scaley = this.scaley;
        }
    }

    function RotationFrame(frameIndex, tween, rotation){
        this.frameIndex = frameIndex;
        this.tween = tween;

        this.rotation = rotation;
    }

    function SkewFrame(frameIndex, tween, skewx, skewy){
        this.frameIndex = frameIndex;
        this.tween = tween;

        this.rotationSkewX = skewx;
        this.rotationSkewY = skewy;

        this.applyNode = function(node){
            node.rotationSkewX = this.rotationSkewX;
            node.rotationSkewY = this.rotationSkewY;
        }
    }

    function AnchorFrame(frameIndex, anchorx, anchory){
        this.frameIndex = frameIndex;

        this.anchorx = anchorx;
        this.anchory = anchory;

        this.applyNode = function(node){
            node.anchorx = this.anchorx;
            node.anchory = this.anchory;
        }
    }

    function InnerActionFrame(frameIndex, innerActionType, startFrame){
        this.frameIndex = frameIndex;

        this.innerActionType = innerActionType;
        this.startFrame      = startFrame;
    }

    function ColorFrame(frameIndex, tween, colorAlphaPercent, colorRedPercent, colorGreenPercent, colorBluePercent){
        this.frameIndex = frameIndex;
        this.tween = tween;

        this.alpha  = colorAlphaPercent;
        this.red    = colorRedPercent;
        this.green  = colorGreenPercent;
        this.blue   = colorBluePercent;

        this.applyNode = function(node){
            node.alpha  = this.alpha;
            node.red    = this.red;
            node.green  = this.green;
            node.blue   = this.blue;
        }
    }

    //////////////////////////////////////////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////////////////////////////////////////
    // help function
    function trace(){
	    var _str = "";
	    for(var _i = 0;_i < arguments.length;_i ++){
		    if(_i!=0){
			    _str += ", ";
		    }
		    _str += arguments[_i];
	    }
	    fl.trace(_str);
    }

    csx.browseFolder = function(){
        var path = fl.browseForFolderURL("Select a folder.");
        return path;
    }

    function createTempItem(){
        if(lib.itemExists(TEMP_ITEM_NAME)){
            lib.deleteItem(TEMP_ITEM_NAME);
        } 
        tempItem = lib.addNewItem("movie clip", TEMP_ITEM_NAME);
    }

    function hashCode(str){
        var hash = 0;
        if (str.length == 0) return hash;
        for (i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    function getElementName(element){
        var name;
        if(element.elementType != 'shape'){

            if(element.instanceType == 'bitmap'){
                if(!isNameContainsPNG(element.libraryItem.name)){
                    name = element.libraryItem.name + '.png';
                }
                else{
                    name = element.libraryItem.name;
                }
            }
            else if(element.instanceType == 'symbol'){
                name = element.libraryItem.name + '.json';
            }
        
        }else{
            name = element.shapeName;
        }
        return name;
    }
     

    function findNodeForLayer(layer, element){
        var nodes = layer.node.children;
        for(var i=0; i<nodes.length; i++){
            if(nodes[i].filePath == getRelativePath(getElementName(element))){
                return nodes[i];
            }
        }

        var id = currentItem.element.node.name + "_" + (++currentItem.actionTag);
        
        var node = new Node();
        node.nodeType = "Sprite";
        node.name = "Sprite";
        node.actionTag = hashCode(id);
        
        // save shape to png
        if(element.elementType == 'shape'){
            saveShapeToPng(element);
        }

        if(element.instanceType == 'symbol'){
            node.nodeType = "Node";
            node.name = "Node";
        }
        
        //for template use, need delete when export
        node.timelines  = [];

        //trace(id+" actionTag: " + node.actionTag);

        node.filePath = getElementName(element);
        node.filePath = getRelativePath(node.filePath);
        trace("create node : " + node.filePath);


        // add visible frame 
        var timeline = getTimelineInNode(FrameType.VISIBLE, node);

        if(currentFrame.startFrame != 0){
            addFrameToTimeline(new VisibleFrame(0, false), timeline);
        }

        addFrameToTimeline(new VisibleFrame(currentFrame.startFrame, true), timeline);

        nodes[nodes.length] = node;

        return node;
    }

    function isNameContainsPNG(name){
        var index = name.lastIndexOf('.png');
        return index >=0 ;    
    }

    function saveShapeToPng(shape){
        shape.shapeName = currentItem.name + '_shape_' + currentItem.shapeIndex + '.png'; 
        var bitmapName = getExportPath(shape.shapeName);
        dom.selectNone();
        
        currentTimeline.setSelectedFrames(currentFrame.startFrame, currentFrame.startFrame);
        dom.selection = [shape];
        dom.clipCopy();
        lib.editItem(TEMP_ITEM_NAME);
        dom.clipPaste();
        
        dom.convertSelectionToBitmap();
        dom.selectAll();

        var item = dom.selection[0].libraryItem;
        item.exportToFile(bitmapName, 100);
        lib.deleteItem(item.name);

        //dom.deleteSelection();
        lib.editItem(currentItem.name);
    }

    // test whether exist a specified timelime type in node
    function testTimelineInNode(frameType, node){
        var timelines = node.timelines;
        var timeline;
        for(var i=0; i<timelines.length; i++){
            if(timelines[i].frameType == frameType){
                timeline = timelines[i];
            }
        }
        return timeline;
    }

    // Gets timeline in a specified node with specified frameType. 
    // If not exists, then create a new one and add to node.timelines. 
    function getTimelineInNode(frameType, node){
        //trace(node.actionTag + "  get timeline : " + frameType);
        var timeline = testTimelineInNode(frameType, node);

        if(!timeline){
            timeline = new Timeline(frameType);
            node.timelines.push(timeline);
            timeline.actionTag = node.actionTag;
        }
        return timeline;
    }

    function addFrameToTimeline(frame, timeline){
        timeline.frames.push(frame);
    }

    function getExportPath(path){
        return exportPath + path;
    }

    function getRelativePath(path){
        return projectName + '/' + path;
    }
    //////////////////////////////////////////////////////////////////////////////////////////////
    // convert function
    csx.convertToAnimation = function(path){
        fl.outputPanel.clear();
        
        dom = fl.getDocumentDOM();
        trace("start convert :" + dom.name);

        projectName = dom.name.substring(0, dom.name.lastIndexOf('.'));
        exportPath = path + '/' + projectName + '/';
	    trace("export Path : " + exportPath);

        lib = dom.library;

        createTempItem();

        var items = lib.items;
        for(var i=0;i<items.length;i++){
            currentItem = items[i];
            convertCurrentItem();
        }
    }

    function convertCurrentItem(){
        trace("item : [type - " + currentItem.itemType + "], [name - " + currentItem.name + "]");

        var fileName = getExportPath(currentItem.name);

        if(currentItem.itemType == 'movie clip' || currentItem.itemType == 'graphic'){
            if(currentItem.name == TEMP_ITEM_NAME) return;
        }
        else if(currentItem.itemType == 'folder'){
            if(!FLfile.exists(fileName)){
                FLfile.createFolder(fileName);
            }
            return;
        }
        else if(currentItem.itemType == 'bitmap'){
            var pngName = fileName;
            if(!isNameContainsPNG(pngName)){
                pngName += '.png';    
            }
            currentItem.exportToFile(pngName, 100);
            return;
        }
        else { 
            return; 
        }

        lib.editItem(currentItem.name);
        currentTimeline = dom.getTimeline(); 

        var element = new AnimationElement();
        element.node.name = currentItem.name;
        element.action.duration = currentTimeline.frameCount;
        element.action.speed = dom.frameRate / 60;

        currentItem.element = element;
        currentItem.shapeIndex = 0;
        currentItem.actionTag = 0;


        for(var i=currentTimeline.layers.length-1; i>=0; i--){
            currentLayer = currentTimeline.layers[i];
            convertCurrentLayer();
        }

        fileName += ".json";
        FLfile.write(fileName,JSON.encode(element));
    }    

    function convertCurrentLayer(){
        lastNode = null;
        lastFrame = null;

        var node = new Node;
        node.name = currentLayer.name;
        node.nodeType = "Node";

        currentItem.element.node.children.push(node);

        currentLayer.node = node;
        
        for(var i = 0; i<currentLayer.frameCount; i++){
            if(i==currentLayer.frames[i].startFrame){
                currentFrame = currentLayer.frames[i];
                convertCurrentFrame();
                lastFrame = currentFrame;
            }
        }

        // move timelines from node to action
        for(var i = 0; i<node.children.length; i++){
            var child = node.children[i];
            for(var j = 0; j<child.timelines.length; j++){
                var timeline = child.timelines[j];
                currentItem.element.action.timelines.push(timeline);

                var firstFrame = timeline.frames[0];
                if(firstFrame && firstFrame.applyNode)
                    firstFrame.applyNode(child);
            }

            delete child.timelines;
            delete child.children;
        }
    }

    function convertCurrentFrame(){
        var node;
        var element;

        var frameIndex = currentFrame.startFrame;

        var tween = false;
        if(currentFrame.tweenType == 'motion')
            tween = true;
        
        if(currentFrame.elements.length != 0){
            element = currentFrame.elements[0];
            node = findNodeForLayer(currentLayer, element);
        }

        if(lastNode && lastNode != node){
            // add visible frame
            var timeline = getTimelineInNode(FrameType.VISIBLE, lastNode);     
            addFrameToTimeline(new VisibleFrame(frameIndex, false), timeline);   
        }

        if(node){
            var visibleTimeline = getTimelineInNode(FrameType.VISIBLE, node);
            if(visibleTimeline && visibleTimeline.frames[visibleTimeline.frames.length-1].visible == false){
                addFrameToTimeline(new VisibleFrame(frameIndex, true), visibleTimeline);   
            }
            
            var positionFrame;
            if(element.instanceType == 'bitmap' || element.elementType == 'shape'){
                positionFrame = new PositionFrame(frameIndex, tween, element.transformX, -element.transformY);
            }
            else if(element.instanceType == 'symbol'){
                positionFrame = new PositionFrame(frameIndex, tween, element.x, -element.y);
            }

            var scaleFrame      = new ScaleFrame   (frameIndex, tween, element.scaleX,     element.scaleY);
            var skewFrame       = new SkewFrame    (frameIndex, tween, element.skewX,      element.skewY);

            addFrameToTimeline(positionFrame,   getTimelineInNode(FrameType.POSITION,   node));
            addFrameToTimeline(scaleFrame,      getTimelineInNode(FrameType.SCALE,      node));
            addFrameToTimeline(skewFrame,       getTimelineInNode(FrameType.SKEW,       node));

            if(element.elementType == 'instance' /*&& element.instanceType != 'shape'*/){
                // create anchor point frame
                convertAnchorPointFrame(frameIndex, element, node);

                // create inner action frame
                convertInnerActionFrame(frameIndex, element, node);

                // create color frame
                convertColorFrame(frameIndex, tween, element, node);
            }
        }

        lastNode = node;
    }

    function convertAnchorPointFrame(frameIndex, element, node){
        if(element.instanceType == 'bitmap'){
            var anchorPoint = element.getTransformationPoint();

            if(anchorPoint.x == 0 && anchorPoint.y == 0){
                if(element.transformX != element.left )
                    anchorPoint.x = element.hPixels/2;
                    anchorPoint.y = element.vPixels/2;
            }
           
//             trace("element.transformX : " + element.transformX + "  element.left : " + element.left);
//             trace("anchorx :  " + anchorPoint.x + "   " + element.hPixels);
//             trace("anchory :  " + anchorPoint.y + "   " + element.vPixels);

            anchorPoint.x = anchorPoint.x/element.hPixels;
            anchorPoint.y = (element.vPixels-anchorPoint.y)/element.vPixels;

            var anchorFrame = new AnchorFrame(frameIndex, anchorPoint.x, anchorPoint.y);
            var anchorTimeline = getTimelineInNode(FrameType.ANCHOR, node);

            if(anchorTimeline.frames.length>0){
                var lastTimelineFrame = anchorTimeline.frames[anchorTimeline.frames.length-1];
                if(anchorPoint.x != lastTimelineFrame.anchorx && anchorPoint.y != lastTimelineFrame.anchory)
                    addFrameToTimeline(anchorFrame, anchorTimeline);
            }
            else{
                addFrameToTimeline(anchorFrame, anchorTimeline);
            }
        }
    }


    function convertInnerActionFrame(frameIndex, element, node){
        if(element.instanceType == 'symbol'){
            var innerActionType = 0;

            if(element.loop == 'loop'){
                innerActionType = 0;
            }
            else if(element.loop == 'play once'){
                innerActionType = 1;
            }
            else if(element.loop == 'single frame'){
                innerActionType = 2;
            }

            var startFrame = element.firstFrame;

            //trace("inner action :  type: " + innerActionType + "  start : " + startFrame);
            
            var innerActionFrame = new InnerActionFrame(frameIndex, innerActionType, startFrame);
            var innerActionTimeline =  testTimelineInNode(FrameType.INNER_ACTION, node);

            if(innerActionTimeline && innerActionTimeline.frames.length>0){
                var lastTimelineFrame = innerActionTimeline.frames[innerActionTimeline.frames.length-1];
                if(innerActionType != lastTimelineFrame.innerActionType || startFrame != lastTimelineFrame.startFrame){
                    addFrameToTimeline(innerActionFrame, getTimelineInNode(FrameType.INNER_ACTION, node));
                }
            }
            else{
                if(innerActionType != 0 || startFrame != 0){
                    addFrameToTimeline(innerActionFrame, getTimelineInNode(FrameType.INNER_ACTION, node));
                }
            }
         }
     }


     function convertColorFrame(frameIndex, tween, element, node){
        if(element.instanceType == 'symbol'){
            
            var a = Math.round(2.55*element.colorAlphaPercent);
		    var r = Math.round(2.55*element.colorRedPercent);
		    var g = Math.round(2.55*element.colorGreenPercent);
		    var b = Math.round(2.55*element.colorBluePercent);

            var colorFrame = new ColorFrame(frameIndex, tween, a, r, g, b);
            var colorTimeline =  testTimelineInNode(FrameType.Color, node);

            addFrameToTimeline(colorFrame, getTimelineInNode(FrameType.Color, node));

//             if(colorTimeline && colorTimeline.frames.length>0){
//                 var lastTimelineFrame = colorTimeline.frames[colorTimeline.frames.length-1];
//                 if(a != lastTimelineFrame.alpha || r != lastTimelineFrame.red || g != lastTimelineFrame.green 
//                     || b != lastTimelineFrame.blue){
// 
//                     addFrameToTimeline(colorFrame, getTimelineInNode(FrameType.Color, node));
//                 }
//             }
//             else{
//                 if(a != 255 || r != 255 || g != 255 || b != 255)
//                     addFrameToTimeline(colorFrame, getTimelineInNode(FrameType.Color, node));
//             }
        }
     }
})();