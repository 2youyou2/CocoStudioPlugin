//var CocoStudioXPluginPath = fl.configURI + "WindowSWF/CocoStudioXPlugin"; 

//fl.runScript( CocoStudioXPluginPath + "/JSON.jsfl" );


/////////////////////////////////////////////////////////////////////////////////////////////////////////
// XMLSerialize
var XMLSerialize;

(function(){
    XMLSerialize = {
        serialize:function(obj, key){
            var name = obj.constructor.name;
            
            if(obj.superName != null){
                name = obj.superName;
            } else if(key){
                name = key;
            }
                
            var xml = XML('<'+name+'/>');
            
            for(var p in obj){
                var t = typeof(obj[p]);
                
                if(p == 'superName'){
                    continue;
                } else if(t == 'function') {
                } else if (obj[p] != null && obj[p].constructor.name == 'Array'){
                    if(obj[p].length == 0)
                        continue;

                    var array = obj[p]; 

                    if(p == 'TimeLineFrames' || p == 'Timelines'){
                        for(var i = 0; i<array.length; i++){
                            xml.appendChild(this.serialize(array[i]));
                        }
                    } else {
                        var arrayXml = XML('<'+p+'/>');
                        for(var i = 0; i<array.length; i++){
                            arrayXml.appendChild(this.serialize(array[i]));
                        }
                        xml.appendChild(arrayXml);
                    }
                    
                } else if(t == 'object') {
                    xml.appendChild(this.serialize(obj[p], p));
                } else {
                    xml.@[p] = obj[p];
                }
            }
            return xml;
        }
    }
})();


///////////////////////////////`//////////////////////////////////////////////////////////////////////////
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

    var lastInnerNode;

    var projectName;
    var exportPath;

    var jsonList;
    
    //////////////////////////////////////////////////////////////////////////////////////////////
    // export struct

    function Solution(){
        this.PropertyGroup = {};
        this.PropertyGroup.Name = "Game";
        this.PropertyGroup.Version = "0.0.0.1";
        this.PropertyGroup.Type = "Flash";

        this.SolutionFolder = {};
        this.SolutionFolder.Group = {ctype:"ResourceGroup"};
        this.SolutionFolder.Group.RootFolder = {Name:"."};
    }

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

    function AnchorPoint(x, y){
        this.ScaleX = x;
        this.ScaleY = y;
    }

    function PropertyGroup(){
        this.Type="GameProject";
        this.Name="1";
        this.ID="a216914d-c0d7-49f6-8da3-6a19dd0dc55f";
        this.Version="0.0.0.1";
    }

    function GameProjectFile(){
        this.PropertyGroup = new PropertyGroup;
        this.Content = {};
        this.Content.ctype = "GameProjectContent";

        this.Content.Content = {};

        this.Content.Content.ObjectData = new NodeObjectData;
        this.Content.Content.Animation = new Animation;


        this.getGameObject = function(){
            return this.Content.Content.ObjectData;
        }

        this.getAnimation = function(){
            return this.Content.Content.Animation;
        }
    }
    function NodeObjectData(){
        this.Name = "Node";
        
        this.ActionTag  = 0;
        this.Tag        = 0;

        this.Position = new Position(0.0, 0.0);
        this.Scale = new Scale(1.0, 1.0);
        this.CColor = new CColor(255, 255, 255);
        this.AnchorPoint = new AnchorPoint(0.5, 0.5);

        this.RotationSkewX = 0.0;
        this.RotationSkewY = 0.0;

        this.Alpha = 255;

        this.Visible = true;
        this.ZOrder = 0;
        this.fileName = "";

//         this.Width  = 0;
//         this.Height = 0;
        
        /*this.ctype      = "NodeObjectData";*/

        this.Children = [];
        this.Timelines  = [];

        this.IconVisible = false;
        this.CanEdit = true;
        //this.IsAutoSize = true;

        this.setFileName = function(name){
            if(name == "")
                return;

            this.fileName = name;
            this.FileData = {
                Type:'Normal',
                Path:name,
                Plist:''
            };
        }
    }

    function Animation(){
        this.Duration   = 0;
        this.Speed      = 1;
        this.Timelines  = [];
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
        this.FrameType  = frameType;
        this.ActionTag  = 0;
        this.TimeLineFrames     = [];
    }


    function VisibleFrame(frameIndex, visible){
        this.FrameIndex = frameIndex;
        this.Value    = visible;

        this.superName = "BoolFrame";
    }

    function PositionFrame(frameIndex, tween, x, y){
        this.FrameIndex = frameIndex;
        this.Tween = tween;

        this.X = x;
        this.Y = y;

        this.superName = "PointFrame";

        this.applyNode = function(node){
            node.Position.X = this.X;
            node.Position.Y = this.Y;
        }
    }

    function ScaleFrame(frameIndex, tween, scaleX, scaleY){

        this.FrameIndex = frameIndex;
        this.Tween = tween;

        this.X = scaleX;
        this.Y = scaleY;

        this.superName = "PointFrame";

        this.applyNode = function(node){
            node.Scale.ScaleX = this.X;
            node.Scale.ScaleY = this.Y;
        }
    }

//     function RotationFrame(frameIndex, tween, rotation){
//         this.FrameIndex = frameIndex;
//         this.tween = tween;
// 
//         this.rotation = rotation;
//     }

    function RotationSkewFrame(frameIndex, tween, skewx, skewy){
        this.FrameIndex = frameIndex;
        this.Tween = tween;

        this.X = skewx;
        this.Y = skewy;

        this.superName = "PointFrame";

        this.applyNode = function(node){
            node.RotationSkewX = this.X;
            node.RotationSkewY = this.Y;
        }
    }

    function AnchorPointFrame(frameIndex, anchorPointX, anchorPointY){
        this.FrameIndex = frameIndex;

        this.X = anchorPointX;
        this.Y = anchorPointY;

        this.superName = "PointFrame";

        this.applyNode = function(node){
            node.AnchorPoint.ScaleX = this.X;
            node.AnchorPoint.ScaleY = this.Y;
        }

    }

    function InnerActionFrame(frameIndex, innerActionType, startFrame){
        this.FrameIndex = frameIndex;

        this.innerActionType = innerActionType;
        this.startFrame      = startFrame;
    }

    function ColorFrame(frameIndex, tween, colorAlphaPercent, colorRedPercent, colorGreenPercent, colorBluePercent){
        this.FrameIndex = frameIndex;
        this.Tween = tween;

        this.Alpha  = colorAlphaPercent;
        this.Color = {};
        this.Color.A  = colorAlphaPercent;
        this.Color.R  = colorRedPercent;
        this.Color.G  = colorGreenPercent;
        this.Color.B  = colorBluePercent;

        this.superName = "ColorFrame";

        this.applyNode = function(node){
            node.CColor.A  = node.Alpha = this.Color.A;
            node.CColor.R  = this.Color.R;
            node.CColor.G  = this.Color.G;
            node.CColor.B  = this.Color.B;
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
        if(str == null)
            str = currentItem.gameObject.Name + "_" + (++currentItem.ActionTag);

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
                name = element.libraryItem.name + '.csd';
            }
        
        }else{
            name = element.shapeName;
        }
        return name;
    }
     

    function findNodeForLayer(layer, element){
        var nodes = layer.node.Children;
        for(var i=0; i<nodes.length; i++){
            if(nodes[i].fileName == getRelativePath(getElementName(element))){
                return nodes[i];
            }
        }

        var node   = new NodeObjectData();
        node.ctype = "SpriteObjectData";
        node.Name  = "SpriteObject";


        node.ActionTag = hashCode();
        
        // save shape to png
        if(element.instanceType == 'symbol'){
            node.ctype = 'ProjectNodeObjectData';
            node.Name="ProjectNodeObject";
        } else {
            if(element.elementType == 'shape'){
                saveShapeToPng(element);
            } 

            node.Size = {};
            node.Size.X = element.hPixels;
            node.Size.Y = element.vPixels;
        }  
        

//         if(element.instanceType == 'symbol'){
//             node.setClassName("Content");
//         }
        
        //for template use, need delete when export
//        node.Timelines  = [];

        //trace(id+" ActionTag: " + node.ActionTag);

        var filename = getElementName(element);
        filename = getRelativePath(filename);
        node.setFileName(filename);
//         node.Width = element.width;
//         node.Height = element.height;
//        node.fileName = getRelativePath(filename);
/*        trace("create node : " + node.fileName);*/


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
        var rect = document.getSelectionRect();

        shape.hPixels = rect.right - rect.left;
        shape.vPixels = rect.bottom - rect.top;

        var item = dom.selection[0].libraryItem;
        item.exportToFile(bitmapName, 100);
        lib.deleteItem(item.name);

        //dom.deleteSelection();
        lib.editItem(currentItem.name);
    }

    // test whether exist a specified timelime type in node
    function testTimelineInNode(frameType, node){
        var Timelines = node.Timelines;
        var timeline;
        for(var i=0; i<Timelines.length; i++){
            if(Timelines[i].FrameType == frameType){
                timeline = Timelines[i];
            }
        }
        return timeline;
    }

    // Gets timeline in a specified node with specified frameType. 
    // If not exists, then create a new one and add to node.Timelines. 
    function getTimelineInNode(frameType, node){
//        trace(node.Name + "  get timeline : " + frameType);
        var timeline = testTimelineInNode(frameType, node);

        if(!timeline){
            timeline = new Timeline(frameType);
            node.Timelines.push(timeline);
            timeline.ActionTag = node.ActionTag;
        }
        return timeline;
    }

    function getLastFrameInTimeline(timeline){
        if(timeline == null || timeline.TimeLineFrames.length == 0)
            return null;
        return timeline.TimeLineFrames[timeline.TimeLineFrames.length-1];
    }

    function addFrameToTimeline(frame, timeline){
        timeline.TimeLineFrames.push(frame);
    }

    function getExportPath(path){
        return exportPath + path;
    }    

    function getExportResourcePath(path){
        var p = exportPath + 'CocosStudio/';
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
        return path;
//         var temp = path;
//         return temp.replace('/', '\\');
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
        

        var solution = new Solution;

        var result = XMLSerialize.serialize(solution);
        /*trace(result);*/
        FLfile.write(getExportPath(projectName) + '.ccs', result);
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
        var gameObject = element.getGameObject();
        var animation  = element.getAnimation();

        gameObject.Name = currentItem.name;
        animation.Duration = currentTimeline.frameCount;
        animation.Speed = dom.frameRate / 60;

        currentItem.gameObject = gameObject;
        currentItem.animation  = animation;

        currentItem.shapeIndex = 0;
        currentItem.ActionTag = 0;


        for(var i=currentTimeline.layers.length-1; i>=0; i--){
            currentLayer = currentTimeline.layers[i];
            convertCurrentLayer();
        }

        fileName = fileName + '.csd';
        FLfile.write(fileName, XMLSerialize.serialize(element));
    }    

    function moveTimelineToAnimation(node, animation){
        for(var j = 0; j<node.Timelines.length; j++){
            var timeline = node.Timelines[j];
            animation.Timelines.push(timeline);

            var firstFrame = timeline.TimeLineFrames[0];
            if(firstFrame && firstFrame.applyNode)
                firstFrame.applyNode(node);
        }

        delete node.Timelines;
    }

    function convertCurrentLayer(){
        lastInnerNode = null;
        lastFrame = null;

        var node = new NodeObjectData;
        node.ActionTag = hashCode();
/*        node.setFileName("");*/
        node.Name = currentLayer.name;
//        node.setClassName("Content");

        currentItem.gameObject.Children.push(node);

//        trace("gameObject.Children : " + currentItem.gameObject.Children.length);

        currentLayer.node = node;
        
        for(var i = 0; i<currentLayer.frameCount; i++){
            if(i==currentLayer.frames[i].startFrame){
                currentFrame = currentLayer.frames[i];
                convertCurrentFrame();
                lastFrame = currentFrame;
            }
        }

        // move Timelines from node to animation
        moveTimelineToAnimation(node, currentItem.animation);

        for(var i = 0; i<node.Children.length; i++){
            var child = node.Children[i];
            moveTimelineToAnimation(child, currentItem.animation);
        }
    }

    function convertCurrentFrame(){
        var innerNode;
        var element;

        var frameIndex = currentFrame.startFrame;

        var tween = false;
        if(currentFrame.tweenType == 'motion')
            tween = true;
        
        if(currentFrame.elements.length != 0){
            element = currentFrame.elements[0];
            innerNode = findNodeForLayer(currentLayer, element);
            if(element.instanceType == 'symbol'){
                innerNode.CanEdit = false;
            }
        }

        if(lastInnerNode && lastInnerNode != innerNode){
            // add visible frame
            var timeline = getTimelineInNode(FrameType.VISIBLE, lastInnerNode);     
            addFrameToTimeline(new VisibleFrame(frameIndex, false), timeline);   
        }

        if(innerNode){
            var visibleTimeline = getTimelineInNode(FrameType.VISIBLE, innerNode);
            var lastFrame = getLastFrameInTimeline(visibleTimeline);
            if(lastFrame && lastFrame.Value == false){
                addFrameToTimeline(new VisibleFrame(frameIndex, true), visibleTimeline);   
            }
            
            var node = currentLayer.node;

            var positionFrame;
            if(element.instanceType == 'bitmap' || element.elementType == 'shape'){
                positionFrame = new PositionFrame(frameIndex, tween, element.transformX, -element.transformY);
            }
            else if(element.instanceType == 'symbol'){
                positionFrame = new PositionFrame(frameIndex, tween, element.transformX, -element.transformY);

                var point = {x:element.x,y:element.y};
                var matrix = element.matrix;
                matrix.tx = element.transformX;
                matrix.ty = element.transformY;
                var m = fl.Math.invertMatrix( matrix );
                var difPoint = fl.Math.transformPoint(m, point);
                difPoint.y = -difPoint.y;

                var innerPositionFrame = new PositionFrame(frameIndex, tween, difPoint.x, difPoint.y);
                addFrameToTimeline(innerPositionFrame,   getTimelineInNode(FrameType.POSITION,   innerNode));
                

//                  trace("matrix" + matrix.tx + " " + matrix.ty);
//                  trace("normal : " + difPoint.x + "  " +  (difPoint.y));
            }
            //trace("transform : " + element.transformX + "  " + (-element.transformY));
            //trace("scale : " + element.scaleX + "  " + element.scaleY);

            var scaleFrame      = new ScaleFrame   (frameIndex, tween, element.scaleX,     element.scaleY);
            var skewFrame       = new RotationSkewFrame    (frameIndex, tween, element.skewX,      element.skewY);

            addFrameToTimeline(positionFrame,   getTimelineInNode(FrameType.POSITION,   node));
            addFrameToTimeline(scaleFrame,      getTimelineInNode(FrameType.SCALE,      node));
            addFrameToTimeline(skewFrame,       getTimelineInNode(FrameType.SKEW,       node));

            if(element.elementType == 'instance' /*&& element.instanceType != 'shape'*/){
                // create anchor point frame
                convertAnchorPointFrame(frameIndex, element, innerNode);

                // create inner animation frame
                // convertInnerActionFrame(frameIndex, element, node);

                // create color frame
                convertColorFrame(frameIndex, tween, element, node);
            }
        }

        lastInnerNode = innerNode;
    }

    function convertAnchorPointFrame(frameIndex, element, node){
        if(element.instanceType == 'bitmap'){
            var anchorPoint = element.getTransformationPoint();

//             trace("b - anchorPointX :  " + anchorPoint.x );
//             trace("b - anchorPointY :  " + anchorPoint.y );

            if(anchorPoint.x == 0 && anchorPoint.y == 0){
                if(element.transformX != element.x )
                {
                    anchorPoint.x = element.hPixels/2;
                    anchorPoint.y = element.vPixels/2;
                }
            }
           
//             trace("element.transformX : " + element.transformX + "  element.left : " + element.left);
//             trace("anchorPointX :  " + anchorPoint.x + "   " + element.hPixels);
//             trace("anchorPointY :  " + anchorPoint.y + "   " + element.vPixels);

            anchorPoint.x = anchorPoint.x/element.hPixels;
            anchorPoint.y = (element.vPixels-anchorPoint.y)/element.vPixels;

//             trace("a - anchorPointX :  " + anchorPoint.x );
//             trace("a - anchorPointY :  " + anchorPoint.y );

            var anchorFrame = new AnchorPointFrame(frameIndex, anchorPoint.x, anchorPoint.y);
            var anchorTimeline = getTimelineInNode(FrameType.ANCHOR, node);

            if(anchorTimeline.TimeLineFrames.length>0){
                var lastTimelineFrame = anchorTimeline.TimeLineFrames[anchorTimeline.TimeLineFrames.length-1];
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

            //trace("inner animation :  type: " + innerActionType + "  start : " + startFrame);
            
            var innerActionFrame = new InnerActionFrame(frameIndex, innerActionType, startFrame);
            var innerActionTimeline =  testTimelineInNode(FrameType.INNER_ACTION, node);

            if(innerActionTimeline && innerActionTimeline.TimeLineFrames.length>0){
                var lastTimelineFrame = innerActionTimeline.TimeLineFrames[innerActionTimeline.TimeLineFrames.length-1];
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

//             if(colorTimeline && colorTimeline.TimeLineFrames.length>0){
//                 var lastTimelineFrame = colorTimeline.TimeLineFrames[colorTimeline.TimeLineFrames.length-1];
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