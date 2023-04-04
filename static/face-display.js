/*=== This script assume that any HTML must include jQuery before using it ===*/

/*--- create a DIV on the body of current document for displaying FACE from user's CAMERA ---*/
function createFaceDisplay(){
  $('body').append( '<div  id="div_FaceDisplay" '+
                          'style="position:fixed; display:none; z-index:100; right:0px; top:0px; width:320px; height:240px; overflow:none; background-color:rgba(255,255,0,0.2);">'+
                          '<iframe id="iframe_FaceDisplay" src="about:blank" '+
                                  'style="position:absolute; top:0px; left:0px; width:100%; height:100%; border: none;" '+ 
                                  'marginwidth="0" marginheight="0" scrolling="No" '+ 
                                  'frameborder="0" hspace="0" vspace="0"></iframe>'+
                    '</div>');
}

/*--- start/top the displaying FACE from user's CAMERA ---*/
function toglleFaceDisplay( userid="", videowidth=320, videoheight=240, facebox=1, facelandmark=0, faceexpression=0, facerecognition=0, requiringcode="", soundnotify="", forceShow=false ) {
  const url_facemonitoring = (window.location.origin.includes('localhost')?window.location.origin:'https://duongthanglong.pythonanywhere.com')+ '/face-monitoring/'
  const facedisplay = $('#div_FaceDisplay').get(0)
  if (facedisplay==null || facedisplay==undefined){
    alert('The FaceDisplay is NOT created on current page!')
    return;
  }
  if (facedisplay.style.display == "none" || forceShow){
    facedisplay.style.width = videowidth+'px'
    facedisplay.style.height = videoheight+'px'
    facedisplay.style.display = "block"
    url = url_facemonitoring+"?userid="+userid+"&videowidth="+videowidth+"&videoheight="+videoheight+
          "&facebox="+facebox+"&facelandmark="+facelandmark+"&faceexpression="+faceexpression+
          "&facerecognition="+facerecognition+"&requiringcode="+requiringcode+"&soundnotify="+soundnotify
    $('#iframe_FaceDisplay').attr("src",url)
  }else{
    facedisplay.style.display = "none"
    $('#iframe_FaceDisplay').attr("src","about:blank")
  }
}

/*----------------------------------------------------------------------------------------*/
function getLastFace(){
  const iframe_FaceDisplay = $('#iframe_FaceDisplay').get(0);
  return iframe_FaceDisplay.contentWindow.document.getElementById('canvas_faceimage');
}
/*----------------------------------------------------------------------------------------*/
function getHistory(){
  return getLastFace().history;
}
/*----------------------------------------------------------------------------------------*/
