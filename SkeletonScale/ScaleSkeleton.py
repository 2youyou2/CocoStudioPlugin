#!/usr/bin/env python
#author: gero

#coding:utf-8

try:
    import xml.etree.cElementTree as ET
    import argparse
except ImportError:
    import xml.etree.ElementTree as ET
import sys
import os

filePath = ""
scale= 1.0
isScaleImage = False

def scaleImage(filepath):
    global scale
    print 'backup image ..', filePath
    suhtil.copy(filePath, "backup_"+filePath)
    print 'scale image ..', filePath
    if False == os.path.exists(filePath):
        print filePath, "not exists!" 
        return
    image = Image.open(filePath)
    image.resize(image.size * scale, Image.ANTIALIAS)
    image.save(filePath)


def scaleObj(objData):
    global scale, isScaleImage
    position = objData.find("Position")
    if(position.get("X")):
        position.set("X", str(float(position.get("X"))*scale))
    if(position.get("Y")):
        position.set("Y", str(float(position.get("Y"))*scale))
    if objData.get("Length"):
        objData.set("Length", str(float(objData.get("Length"))*scale))
    if isScaleImage and (objData.get("ctype") == "SpriteObjectData"):
        scaleImage(objData.find("FileData").get("Path"))
    children = objData.find("Children")
    if(children):
        for child in children.findall("AbstractNodeData"):
            scaleObj(child)


def scaleSkeleeton():
    global filePath, scale
    print 'parse file ...', filePath
    
    xmltree = ET.parse(filePath)
    root = xmltree.getroot()
    

    if root[0].get("Type") != "Skeleton":
        print "error: ", filePath, "is not a skeleton file"
        return 
    
    print 'scale animation ... '
    content = root.find("Content").find("Content")
    animation = content.find("Animation")
    for timeline in animation:
        if(timeline.get("Property") == "Position"):
            for pointframe in timeline:
                pointframe.set("X", str(float(pointframe.get("X"))*scale))
                pointframe.set("Y", str(float(pointframe.get("Y"))*scale))
    outfilename = "scaled_" + str(scale) + "_"  + filePath

    print 'scale object ... '
    objData = content.find("ObjectData")
    scaleObj(objData)
    print "write scaled csd ", outfilename
    xmltree.write(outfilename)

def parseArgs():
    parser = argparse.ArgumentParser(description = "scale a skeleton animation")
    parser.add_argument("filepath", help = "skeleton files")
    parser.add_argument("scale", type = float, help = "scale animation's  ", default=1.0)
    parser.add_argument("-i", "--image", help = "scale the images, can not scale the images in sprite sheet,\n need script file(.py) is in the cocostudio dir,\n images will be blur after zoomed (scale > 1.0) ", action = "store_true", default=False)


    args = parser.parse_args()
    global filePath, scale, isScaleImage
    filePath = args.filepath
    scale = args.scale
    if(args.image):
        isScaleImage = True

if __name__ == '__main__':
    parseArgs()
    if(isScaleImage):
        from PIL import Image
        import suhtil
        print "image"
    scaleSkeleeton()