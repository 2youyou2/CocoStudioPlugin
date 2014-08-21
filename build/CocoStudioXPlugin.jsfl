var CocoStudioXPluginPath = fl.configURI + "WindowSWF/CocoStudioXPlugin"; 

fl.runScript( CocoStudioXPluginPath + "/JSON.jsfl" );


/////////////////////////////////////////////////////////////////////////////////////////////////////////
// XMLSerialize
var XMLSerialize;

(function(){
    XMLSerialize = {
        serialize:function(obj){
            var xml = XML('<'+obj.constructor.name+'/>');
            for(var p in obj){
                var t = typeof(obj[p]);
                
                if(t == 'function') {
                } else if (obj[p] != null && obj[p].constructor.name == 'Array'){
                    if(obj[p].length == 0)
                        continue;

                    var arrayXml = XML('<'+p+'/>');
                    var array = obj[p];
                    for(var i = 0; i<array.length; i++){
                        arrayXml.appendChild(this.serialize(array[i]));
                    }
                    xml.appendChild(arrayXml);
                } else if(t == 'object') {
                    xml.appendChild(this.serialize(obj[p]));
                } else {
                    xml.@[p] = obj[p];
                }
            }

            return xml;
        }
    }
})();


/////////////////////////////////////////////////////////////////////////////////////////////////////////
// csx
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

    var jsonList;
    
    //////////////////////////////////////////////////////////////////////////////////////////////
    // export struct
    function Position(x, y){
        this.X = x;
        this.Y = y;
    }

    function Scale(x, y){
        this.ScaleX = x;
        this.ScaleY = y;
    }

    function CColor(r, g, b){
        this.A = 255;
        this.R = r;
        this.G = g;
        this.B = b;
    }

    function PropertyGroup(){
        this.Type="GameProject";
        this.Name="1";
        this.ID="a216914d-c0d7-49f6-8da3-6a19dd0dc55f";
        this.Version="0.0.0.1";
    }

    function GameProjectFile(){
        this.group = new PropertyGroup;
        this.project = new Content;
        for(var i in this.project){
            delete this.project[i];
        }
        this.project.ctype = "GameProjectContent";

        this.project.nodeTree = new Content;
        this.project.action   = new Action;

    }
    function Content(){
        this.name = "Node";
        
        this.ActionTag  = 0;
        this.Tag        = 0;

        this.Pos = new Position(0.0, 0.0);
        this.Scale = new Scale(1.0, 1.0);
        this.Color = new CColor(255, 255, 255);

        this.RotationSkewX = 0.0;
        this.RotationSkewY = 0.0;

        this.Alpha = 255;

        this.Visible = true;
        this.ZOrder = 0;
        this.fileName = "";
        
        this.ctype      = "NodeObjectData";

        this.children = [];

        this.setFileName = function(name){
            this.fileName = name;
            this.fileNameData = {
                resourceType:0,
                path:name,
                plistFile:''
            };
        }
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
        ANCHOR:         "AnchorPointFrame",
        INNER_ACTION:   "InnerActionFrame",
        Color:          "ColorFrame"
    }

    function Timeline(frameType){
        this.frameType  = frameType;
        this.ActionTag  = 0;
        this.frames     = [];
    }


    function VisibleFrame(frameIndex, visible){
        this.frameIndex = frameIndex;
        this.value    = visible;
    }

    function PositionFrame(frameIndex, tween, x, y){
        this.frameIndex = frameIndex;
        this.tween = tween;

        this.x = x;
        this.y = y;

        this.applyNode = function(node){
            node.Pos.X = this.x;
            node.Pos.Y = this.y;
        }
    }

    function ScaleFrame(frameIndex, tween, scaleX, scaleY){

        this.frameIndex = frameIndex;
        this.tween = tween;

        this.x = scaleX;
        this.y = scaleY;

        this.applyNode = function(node){
            node.Scale.ScaleX = this.x;
            node.Scale.ScaleY = this.y;
        }
    }

//     function RotationFrame(frameIndex, tween, rotation){
//         this.frameIndex = frameIndex;
//         this.tween = tween;
// 
//         this.rotation = rotation;
//     }

    function RotationSkewFrame(frameIndex, tween, skewx, skewy){
        this.frameIndex = frameIndex;
        this.tween = tween;

        this.x = skewx;
        this.y = skewy;

        this.applyNode = function(node){
            node.RotationSkewX = this.x;
            node.RotationSkewY = this.y;
        }
    }

    function AnchorPointFrame(frameIndex, anchorPointX, anchorPointY){
        this.frameIndex = frameIndex;

        this.x = anchorPointX;
        this.y = anchorPointY;

        this.applyNode = function(node){
            node.AnchorPointX = this.x;
            node.AnchorPointY = this.y;
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
            node.Color.A  = node.Alpha = this.alpha;
            node.Color.R  = this.red;
            node.Color.G  = this.green;
            node.Color.B  = this.blue;
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
            if(nodes[i].fileName == getRelativePath(getElementName(element))){
                return nodes[i];
            }
        }

        var id = currentItem.nodeTree.name + "_" + (++currentItem.ActionTag);
        
        var node = new Content();
//        node.setClassName("Sprite");
//        node.name = "Sprite";
        node.ActionTag = hashCode(id);
        
        // save shape to png
        if(element.elementType == 'shape'){
            saveShapeToPng(element);
        }

//         if(element.instanceType == 'symbol'){
//             node.setClassName("Content");
//         }
        
        //for template use, need delete when export
        node.timelines  = [];

        //trace(id+" ActionTag: " + node.ActionTag);

        var filename = getElementName(element);
        filename = getRelativePath(filename);
        node.setFileName(filename);
//        node.fileName = getRelativePath(filename);
        trace("create node : " + node.fileName);


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
        var bitmapName = getExportResourcePath(shape.shapeName);
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
        //trace(node.ActionTag + "  get timeline : " + frameType);
        var timeline = testTimelineInNode(frameType, node);

        if(!timeline){
            timeline = new Timeline(frameType);
            node.timelines.push(timeline);
            timeline.ActionTag = node.ActionTag;
        }
        return timeline;
    }

    function addFrameToTimeline(frame, timeline){
        timeline.frames.push(frame);
    }

    function getExportPath(path){
        return exportPath + path;
    }    

    function getExportResourcePath(path){
        var p = exportPath + 'Resources/';
        if(!FLfile.exists(p)){
                FLfile.createFolder(p);
        }
        p = p + path;
        return p;
    }

    function getExportJsonPath(){
        var p = exportPath + 'Json/';
        if(!FLfile.exists(p)){
                FLfile.createFolder(p);
        }
        return p;
    }

    function getRelativePath(path){
//        return projectName + '/' + path;
        return path;
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

        jsonList = [];
        
        var items = lib.items;
        for(var i=0;i<items.length;i++){
            currentItem = items[i];
            convertCurrentItem();
        }
        
        var projectXML = '\
<?xml version="1.0"?> \n \
<UIProject xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"> \n \
    <ProjectDir></ProjectDir> \n \
    <Version>1.0.0.0</Version> \n \
    <Resources></Resources> \n \
    <Name>' + projectName +'</Name> \n \
    <JsonFileName>boy.json</JsonFileName> \n \
    <JsonFolder></JsonFolder> \n \
    <JsonList>\n';

    for(var i=0; i<jsonList.length; i++){
        projectXML += '        <string>'+ jsonList[i] +'</string>\n';
    }

projectXML +='\
     </JsonList> \n \
    <CanvasSize> \n \
        <Width>480</Width> \n \
        <Height>320</Height> \n \
    </CanvasSize> \n \
    <filePath></filePath> \n \
    <ProjectType>UIProject</ProjectType> \n \
    <ResRelativePath /> \n \
    <imageFileList /> \n \
    <imagePngList /> \n \
    <JsonSuffix>.json</JsonSuffix> \n \
    <CurrentUIJson>boy_1.json</CurrentUIJson> \n \
</UIProject>';

//         var projectXML = new XML("<UIProject />");
//         projectXML.@name = '123';

        var xmlPath = getExportPath(projectName) + '.xml.ui';
        FLfile.write(xmlPath, projectXML);


//         var x = XML("<test />");
//         x.@data = "sdf";
// 
//         var result = XML("<panels />");
//         result.appendChild(x);
// 
//         FLfile.write(getExportPath(projectName) + '.xml', result);


//         var node = new Content();
//         node.children[0] = new Content();
//         
//         var result = XMLSerialize.serialize(node);
//         trace(result);

//        FLfile.write(getExportPath(projectName) + '.xml', result);
    }

    function convertCurrentItem(){
        trace("item : [type - " + currentItem.itemType + "], [name - " + currentItem.name + "]");

        var fileName = getExportResourcePath(currentItem.name);

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

        var element = new GameProjectFile();
        element.project.nodeTree.name = currentItem.name;
        element.project.action.duration = currentTimeline.frameCount;
        element.project.action.speed = dom.frameRate / 60;

        currentItem.nodeTree = element.project.nodeTree;
        currentItem.action   = element.project.action;

        currentItem.shapeIndex = 0;
        currentItem.ActionTag = 0;


        for(var i=currentTimeline.layers.length-1; i>=0; i--){
            currentLayer = currentTimeline.layers[i];
            convertCurrentLayer();
        }

        var jsonPath = getExportJsonPath();
        var jsonName = currentItem.name.substring(currentItem.name.lastIndexOf('/')+1, currentItem.name.length) + '.json';
        var projName = currentItem.name.substring(currentItem.name.lastIndexOf('/')+1, currentItem.name.length) + '.ccsproj';

        fileName = jsonPath + jsonName;
        jsonList[jsonList.length] = jsonName;
        trace("json : " + fileName);
        FLfile.write(fileName, JSON.encode(element));

        fileName = jsonPath + projName;
        trace(fileName);
        FLfile.write(fileName, XMLSerialize.serialize(element));
    }    

    function convertCurrentLayer(){
        lastNode = null;
        lastFrame = null;

        var node = new Content;
        node.setFileName("");
        node.name = currentLayer.name;
//        node.setClassName("Content");

        currentItem.nodeTree.children.push(node);

//        trace("nodeTree.children : " + currentItem.nodeTree.children.length);

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
                currentItem.action.timelines.push(timeline);

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
            var skewFrame       = new RotationSkewFrame    (frameIndex, tween, element.skewX,      element.skewY);

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
//             trace("anchorPointX :  " + anchorPoint.x + "   " + element.hPixels);
//             trace("anchorPointY :  " + anchorPoint.y + "   " + element.vPixels);

            anchorPoint.x = anchorPoint.x/element.hPixels;
            anchorPoint.y = (element.vPixels-anchorPoint.y)/element.vPixels;

            var anchorFrame = new AnchorPointFrame(frameIndex, anchorPoint.x, anchorPoint.y);
            var anchorTimeline = getTimelineInNode(FrameType.ANCHOR, node);

            if(anchorTimeline.frames.length>0){
                var lastTimelineFrame = anchorTimeline.frames[anchorTimeline.frames.length-1];
                if(anchorPoint.x != lastTimelineFrame.anchorPointX && anchorPoint.y != lastTimelineFrame.anchorPointY)
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