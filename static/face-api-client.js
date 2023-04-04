const satisfactions = {good:["happy","surprised"],average:["neutral"],bad:["angry","disgusted","fearful","sad"]}
const faceModelWeights_URL = '/static/weights'
const span_onoffvideo_textoff = '\u2610', span_onoffvideo_texton = '\u2611'
const MAX_FACEHISTORY = 1600000 /*depends on memory*/
var   videoWidth = 320, videoHeight = 240
var   isLoadedFaceModels = false
var   minConfidence4Detection = 0.5, minConfidence4Reconigtion = 0.5
var   faceMatcher = null
var   canvasEl_overlay = null, canvasEl_videoframe = null, canvasEl_faceimage = null;
const long_time_notify = 300;
var   sound_absent = null, sound_attend = null;
var   attend_absent_count = 0; /*negative=absent, positive=attend*/
var   parameters_responsedata = null;

/*----------------------------------------------------------------------------------------*/
function getFaceExpression( resizedResult ){
  let fex = resizedResult.expressions;
  let smax=0, eml=""
  for (var k in fex){
    if (fex[k]>smax){
      smax = fex[k]; eml = k;
    }
  }
  fe_label = satisfactions.good.includes(eml)?"Cao": satisfactions.average.includes(eml)?"Vừa":"Thấp"
  fe_color = fe_label=="Cao"?'rgba(0,0,255,1)':fe_label=="Vừa"?'rgba(0,255,0,1)':'rgba(255,0,0,1)'
  return {expression:fe_label, score:smax, color:fe_color}
}
/*----------------------------------------------------------------------------------------*/
function getFaceBox(resizedResult, heso ){
  let le = resizedResult.landmarks.getLeftEye(), 
      re = resizedResult.landmarks.getRightEye(),
      mt = resizedResult.landmarks.getMouth()
  let lex=0, ley=0, rex=0, rey=0, mtx=0, mty=0
  le.forEach((p) => { lex += p._x; ley += p._y; })
  re.forEach((p) => { rex += p._x; rey += p._y; })
  mt.forEach((p) => { mtx += p._x; mty += p._y; })
  
  lex /= le.length; ley /= le.length;
  rex /= re.length; rey /= re.length;
  mtx /= mt.length; mty /= mt.length;
  fcx = (lex+rex+mtx)/3; fcy = (ley+rey+mty)/3
  dx = Math.max(0,rex-lex)
  dy = 4*dx/3
  fw = heso*dx, fh = heso*dy
  fx = fcx - fw/2; fy = fcy - fh/2
  return {box:{x:fx, y:fy, width:fw, height:fh}, score:resizedResult.detection.score}
}
/*----------------------------------------------------------------------------------------*/
function round(num, prec) {
  if (prec === void 0) { prec = 1; }
  let f = Math.pow(10, prec);
  return Math.floor(num * f) / f;
}
/*----------------------------------------------------------------------------------------*/
function showFaceInfor( overlayCanvas, resizedResult, videoFrame, isFaceBox, isFaceLandmark, isFaceExpression, isFaceRecognition ){
  const fb = getFaceBox(resizedResult, 2.7)

  /* extract face & descriptor */
  canvasEl_faceimage.miliseconds = Date.now();
  canvasEl_faceimage.facedescriptor = resizedResult.descriptor
  canvasEl_faceimage.width = fb.box.width
  canvasEl_faceimage.height = fb.box.height
  var ctx = canvasEl_faceimage.getContext('2d')
  ctx.drawImage(videoFrame, fb.box.x, fb.box.y, fb.box.width, fb.box.height, 0,0,fb.box.width, fb.box.height)

  /*draw information of face on overlay canvas*/
  ctx = overlayCanvas.getContext('2d');
  if (isFaceBox){
    ctx.strokeStyle = 'rgba(0, 0, 255, 1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(fb.box.x, fb.box.y, fb.box.width, fb.box.height);
    ssize = 'XY('+Math.floor(fb.box.x)+','+Math.floor(fb.box.y)+')WH('+Math.floor(fb.box.width)+','+Math.floor(fb.box.height)+')'
    ctx.fillStyle = "yellow";
    ctx.font = "10px Verdana";
    ctx.fillText(ssize, fb.box.x, fb.box.y-5)
  }
  
  if (isFaceLandmark){
    faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedResult);
  }
  
  const fe = getFaceExpression(resizedResult);
  if (isFaceExpression){
    sfe = fe.expression+'('+round(fe.score*100)+'%)';
    ctx.fillStyle = fe.color;
    ctx.font = "10px Verdana";
    ctx.fillText(sfe, 2, 12)
  }
  
  var fm = faceMatcher.findBestMatch(resizedResult.descriptor)
  if(isFaceRecognition){
    sfe = 'NO students'
    if(fm){
      const num_char=27;
      sfe = fm.label.substring(0,num_char)+(fm.label.length>num_char?"~":"")+"("+round((fm.similarity)*100)+"%)";
    }
    ctx.fillStyle = "red";
    ctx.font = "10px Verdana";
    ctx.fillText(sfe, 2, overlayCanvas.height-2)
  }
  if (fm){
    return {miliseconds:Date.now(), expression:fe.expression, score:fe.score, label:fm.label, similarity:fm.similarity }; //history {face expression and label of user-id, similarity} of facing
  }else{
    return {miliseconds:Date.now(), expression:fe.expression, score:fe.score, label:'', similarity:0 };
  }  
}
/*----------------------------------------------------------------------------------------*/
function checkNotifySendHistory(face_match) {
  // console.log(attend_absent_count)  
  if (faceMatcher && faceMatcher.userid!=''){
    sendHistory(face_match)
    if (parameters_responsedata.soundnotify=="1"){
      if (attend_absent_count==1 || attend_absent_count>long_time_notify){
        if (attend_absent_count==1) { sound_attend.play() }
        attend_absent_count = attend_absent_count>long_time_notify?2:attend_absent_count
      }else if(attend_absent_count==-1 || attend_absent_count<-long_time_notify){
        sound_absent.play()
        attend_absent_count = attend_absent_count<-long_time_notify?-2:attend_absent_count
      }
    }
  }
}
/*----------------------------------------------------------------------------------------*/
function sendHistory(face_match) {
  if (parameters_responsedata.responsedata.sendback_allowcode!='' && faceMatcher && faceMatcher.userid!=''){
    if (!face_match){
      face_match = {miliseconds:0, expression:'', score:0, label:'', similarity:0 }
    }
    face_match['userid'] = faceMatcher.userid
    face_match['sendback_allowcode'] = parameters_responsedata.responsedata.sendback_allowcode
    $.ajax({
      type: "POST",
      url: (window.location.origin.includes('localhost')?window.location.origin:'https://houfar.onrender.com')+'/face-monitoring/',
      data: face_match,
      /*success: function (response) { 
        // console.log('send history:',response['results']); 
      },*/
      /*error: function (xhr){
        console.log('send back history - error response:',xhr);
      }*/
    });
  }
}
/*----------------------------------------------------------------------------------------*/
async function onPlay() {
  const videoEl = $('#inputVideo').get(0)

  if(videoEl.paused || videoEl.ended || !isLoadedFaceModels)
    return setTimeout(() => onPlay())

  // draw current video frame to canvas for using later
  if (canvasEl_videoframe){
    canvasEl_videoframe.width = videoWidth;
    canvasEl_videoframe.height = videoHeight;
    var ctx = canvasEl_videoframe.getContext('2d')
    ctx.save()
    ctx.translate(canvasEl_videoframe.width, 0);
    ctx.scale(-1,1);
    ctx.drawImage(videoEl, 0, 0, videoWidth, videoHeight);
    ctx.restore();

    //process current video frame to face: detection/landmarks/expressions/descriptor
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence4Detection })
    const result = await faceapi
      .detectSingleFace(canvasEl_videoframe, options) //replace "videoEl" with "canvasEl_videoframe"
      .withFaceLandmarks()
      .withFaceExpressions()
      .withFaceDescriptor()

    if ($('#span_onoffvideo').get(0).innerHTML==span_onoffvideo_texton) {
      var face_match=null;
      if (result) {
        const dims = faceapi.matchDimensions(canvasEl_overlay, canvasEl_videoframe, true)
        const resizedResult = faceapi.resizeResults(result, dims)

        const elm = $("#div_parameters_responsedata").get(0)
        const fbx = true/*(default always show)elm.facebox=="1"*/, flm = elm.facelandmark=="1",
              fxp = elm.faceexpression=="1", fre = elm.facerecognition=="1"

        face_match = showFaceInfor(canvasEl_overlay, resizedResult, canvasEl_videoframe, fbx, flm, fxp, fre)

        /*push history*/
        if (canvasEl_faceimage.history.length<MAX_FACEHISTORY){
          canvasEl_faceimage.history.push(face_match)
        }else{
          out = canvasEl_faceimage.history.shift()
          canvasEl_faceimage.history.push(face_match)
        }

        if (face_match.label!=''){ /*có mặt trên camera*/
          if(face_match.similarity<minConfidence4Reconigtion){
            attend_absent_count = attend_absent_count<0?attend_absent_count-1:-1;
          }else{
            attend_absent_count = attend_absent_count>0?attend_absent_count+1:1;
          }          
        }
      }else{ /*không có mặt trên camera*/
        attend_absent_count = attend_absent_count<0?attend_absent_count-1:-1;
      }
      setTimeout(() => checkNotifySendHistory(face_match))
    }
  }

  setTimeout(() => onPlay())
}
/*----------------------------------------------------------------------------------------*/
async function loadModels() {
  const vs = $('#span_onoffvideo').get(0)
  vs.waitingProcess = 1
  const id_wait4Loading = setInterval(wait4Loading, 100, vs, 'Loading...', 1, 3000 );
  
  // load face detection/landmark/expression/recognition model
  await faceapi.nets.ssdMobilenetv1.load(faceModelWeights_URL)
  await faceapi.loadFaceLandmarkModel(faceModelWeights_URL)
  await faceapi.loadFaceExpressionModel(faceModelWeights_URL)
  await faceapi.loadFaceRecognitionModel(faceModelWeights_URL)
  isLoadedFaceModels = true
  
  //init other elements of the document
  clearInterval(id_wait4Loading)
  vs.innerHTML = span_onoffvideo_texton
  vs.onclick = function(event){ 
    const vs = $('#span_onoffvideo').get(0)
    if (vs.innerHTML == span_onoffvideo_texton){ vs.innerHTML = span_onoffvideo_textoff;}
    else{ vs.innerHTML = span_onoffvideo_texton; }
    video_onoff();
  }

  // try to access users webcam and stream the images to the video element
  video_onoff();
}
/*----------------------------------------------------------------------------------------*/
$(document).ready(function() {
  canvasEl_overlay = $("#overlay").get(0);
  canvasEl_faceimage = $("#canvas_faceimage").get(0);
  if (canvasEl_faceimage){ canvasEl_faceimage.history = [] }
  canvasEl_videoframe = $("#canvas_videoframe").get(0);
  parameters_responsedata = $("#div_parameters_responsedata").get(0)  
  
  /*Get width & height of expected video, then set for mobile/computer*/
  const vw = parameters_responsedata?Number(parameters_responsedata.videowidth):videoWidth;
  const vh = parameters_responsedata?Number(parameters_responsedata.videoheight):videoHeight;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|pocket|psp|kindle|avantgo|blazer|midori|Tablet|Palm|maemo|plucker|phone|BlackBerry|symbian|IEMobile|mobile|ZuneWP7|Windows Phone|Opera Mini/i.test(navigator.userAgent)  
  if (isMobile){
    videoWidth = vh >= 64?vh:videoHeight;
    videoHeight = vw >= 48?vw:videoWidth;
  }else{
    videoWidth = vw >= 64?vw:videoWidth;
    videoHeight = vh >= 48?vh:videoHeight;
  }
  
  /*Sounds for notifying*/
  uri = (window.location.origin.includes('localhost')?window.location.origin:'https://houfar.onrender.com')+'/static/sounds'
  sound_absent = new Audio(uri+'/absent.mp3');
  sound_attend = new Audio(uri+'/attend.mp3');
  
  /*FaceMatcher for matching similarity of detected face*/
  data = parameters_responsedata?parameters_responsedata.responsedata:null
  faceMatcher = data?new FaceMatcher(data.userid, data.descriptors):null
  loadModels();
})
/*----------------------------------------------------------------------------------------*/
function wait4Loading(elem, waitString, step, maxwidth) {
  elem.waitingProcess = (elem.waitingProcess + step)%maxwidth;
  elem.innerHTML = waitString + elem.waitingProcess + '0 %sec';
}
/*----------------------------------------------------------------------------------------*/
async function video_onoff() {
  const vs_onoff = $('#span_onoffvideo').get(0);
  const videoEl = $('#inputVideo').get(0);
  if (vs_onoff.innerHTML == span_onoffvideo_textoff){
    vs_onoff.title = "Bấm để bật hình ảnh";
    stream = videoEl.srcObject;
    if (stream!=null && stream!=""){
      stream.getTracks().forEach(function(track){
        track.stop();
      })
    }
    videoEl.srcObject = null;
    canvasEl_overlay.style.display = 'none';
  }else{
    vs_onoff.title = "Bấm để tắt hình ảnh";
    navigator.mediaDevices.getUserMedia({ video: {width:videoWidth,height:videoHeight} })
        .then(stream => {
          videoEl.srcObject = stream;
          canvasEl_overlay.style.display = '';
        })
        .catch(error => {
          console.error('Error accessing media devices.', error);
        });
  }  
}
/*----------------------------------------------------------------------------------------*/
class FaceMatcher {
  constructor(userid, descriptors) { 
    this.userid = userid;
    this.descriptors = [];
    descriptors = descriptors.split('#');
    for (var i=0; i<descriptors.length; i++){
      var des = descriptors[i].split(';');
      var arr = [];
      for (var j=0;j<des.length;j++){
        arr.push(Number(des[j]));        
      }
      this.descriptors.push(arr);
    }
    // console.log(this.userid,this.descriptors)
  }
  findBestMatch(descriptor){ 
    if (this.userid=="" || this.descriptors.length==0){
      return null;
    }
    var A=descriptor, smax=0; //Number.MAX_VALUE;
    for (var i=0;i<this.descriptors.length;i++){
      var dotproduct=0, B=this.descriptors[i];
      for(i = 0; i < A.length; i++){
        dotproduct += (A[i] - B[i])**2;
      }
      var similarity = Math.sqrt(dotproduct);
      similarity = 1/(1+Math.exp(-27*(0.49-similarity))); //0.45
      if (smax<similarity){
        smax = similarity;
      }
    }
    return { label:this.userid, similarity:smax };
  }
}
/*----------------------------------------------------------------------------------------*/

/*document.addEventListener('keydown', function(event) {
  console.log(event)
  alert("This function has been disabled!");
  event.preventDefault();
  return false;
}, false);

if (document.addEventListener) {
  document.addEventListener('contextmenu', function(event) {
    alert("This function has been disabled!");
    event.preventDefault();
    return false;
  }, false);
} else {
  document.attachEvent('oncontextmenu', function(event) {
    alert("This function has been disabled!");
    event.preventDefault();
    window.event.returnValue = false;
    return false;
  });
}*/

