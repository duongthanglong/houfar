/*=== This script assume that any HTML must include jQuery before using it ===*/

/*-------------------------------------------------*/
var   loggedin_userid = null;
const num_imgs_array = [[13, 0,12, 0,11],
                        [ 0, 5, 4, 3, 0],
                        [14, 6, 1, 2,10],
                        [ 0, 7, 8, 9, 0],
                        [15, 0,16, 0,17]];
const str_imgs_array = [['Ngoài Trái-Trên', '','Ngoài Trên', '','Ngoài Phải-Trên'],
                        [ '', 'Trái-Trên', 'Trên', 'Phải-Trên', ''],
                        ['Ngoài Trái', 'Trái', 'Giữa', 'Phải','Ngoài Phải'],
                        [ '', 'Trái-Dưới', 'Dưới', 'Phải-Dưới', ''],
                        ['Ngoài Trái-Dưới', '','Ngoài Dưới', '','Ngoài Phải-Dưới']];

/*-------------------------------------------------*/
/*--- create a DIV & Table on the body of current document for displaying user's images ---*/
function createImagesTable(userid){
  html_table = '<div  id="div_ImagesTable"><table style="width:75%;">';
  for (var r=0; r<5; r++){
    html_table += '<tr>'
    for (var c=0; c<5; c++){      
      img_src = num_imgs_array[r][c]>0 && userid!=''?userid+'/'+userid+'_'+num_imgs_array[r][c]+'.jpg':'';
      img_alt = num_imgs_array[r][c]>0?'picture_'+num_imgs_array[r][c]:'NoPicture';
      img_des = num_imgs_array[r][c]>0?str_imgs_array[r][c]+':'+num_imgs_array[r][c]:'Không chụp ảnh';
      img_tit = num_imgs_array[r][c]>0?'Bấm vào ảnh để chụp => '+img_des:'';
      html_table += '<td class="img">'+
        '<img id="img_'+num_imgs_array[r][c]+
        '" style="width:100%" src="'+img_src+'" alt="'+img_alt+
        '" title="'+img_tit+'" onclick="videoCapture(this)">'+
        '<br><label id="label_'+num_imgs_array[r][c]+'" style="text-align:center;width:100%;background-color:rgba(0,255,255,0.5)">'+img_des+'</label>'+
        '</td>'
    }
    html_table += '</tr>'
  }
  html_table += '</table></div>';
  // html_table += '<canvas id="canvasCapturedPicture" style="display:none;"></canvas>';
  $('body').append(html_table);
}
/*-------------------------------------------------*/
function updateImagesTable(userid){
  for (var r=0; r<5; r++){
    for (var c=0; c<5; c++){      
      $('#img_'+num_imgs_array[r][c]).get(0).src = num_imgs_array[r][c]>0 && userid!=''?userid+'/'+userid+'_'+num_imgs_array[r][c]+'.jpg':'';
    }
  }
}
/*-------------------------------------------------*/
/*--- capture user's picture from camera at currently looking position ---*/
function videoCapture(img){
  const divFaceDisplay = $('#div_FaceDisplay').get(0);
  if (typeof divFaceDisplay === undefined || divFaceDisplay.style.display=='none'){
    if (img.alt!='NoPicture'){
      alert('Chưa bật hình ảnh từ CAMERA để chụp!');
    }
    return;
  }
  if (img.alt!='NoPicture'){
    const canvasvideo = getLastFace();
    var data = canvasvideo.toDataURL('image/jpeg').replace(/^.*,/, '');
    var descriptor = canvasvideo.facedescriptor;
    
    //send to server captured image if user has been logged-in
    if (loggedin_userid!=null){
      const mls = Date.now()-canvasvideo.miliseconds;
      if(mls<=1000){
        pos = img.alt.substring(8);
        const slab=$('#label_'+pos).get(0).innerHTML;
        $('#label_'+pos).get(0).innerHTML = 'Chờ xử lý hình ảnh nhận dạng...';
        frmdat = new FormData();
        frmdat.append('img', data);
        frmdat.append('userid', loggedin_userid);
        frmdat.append('position', pos);
        frmdat.append('descriptor', descriptor);
        $.ajax({
          type: "POST",
          url: window.location.origin+"/capturing",
          data: frmdat,
          cache : false,
          contentType : false,
          processData : false,
          success: function (response) {
            if (response['results']){
              img.src = response['savedfile']+"?"+new Date().getTime()
              
            }else{
              alert('Lưu hình ảnh đã chụp lên máy chủ không thực hiện được!')
            }
            $('#label_'+pos).get(0).innerHTML = slab
          },
          error: function (xhr){
            alert('Lỗi kết nối đến máy chủ:'+xhr);
            $('#label_'+pos).get(0).innerHTML = slab
          }
        });
      }else{
        alert('Hình ảnh không có kịp thời để lưu trữ!')
      }
    }else{
      alert('Bạn chưa đăng nhập!')
    }
  }
}

/*-------------------------------------------------*/
/*--- register new user ---*/
function register_user(){
  alert('Bạn không được phép thực hiện chức năng này!')
}

/*-------------------------------------------------*/
/*--- login user ---*/
function login_user(){
  if ($('#btn_login').get(0).innerHTML=='Đăng nhập'){
    userid = $('#inp_username').get(0).value
    user_pass = $('#inp_password').get(0).value
    $.ajax({
      type: "POST",
      url: (window.location.origin.includes('localhost')?window.location.origin:'https://houfar.onrender.com')+'/capturing',
      data: {'userid':userid, 'userpass':user_pass},
      success: function (response) {
        if (response['results']){
          loggedin_userid = userid
          $('#inp_username').get(0).disabled = true
          $('#inp_password').get(0).disabled = true
          $('#btn_login').get(0).innerHTML = 'Đăng xuất'
          updateImagesTable(loggedin_userid)
          //toglleFaceDisplay( userid="", videowidth=320, videoheight=240, facebox="", facelandmark="", faceexpression="", facerecognition="", requiringcode="", soundnotify="", forceShow=false )
          toglleFaceDisplay(loggedin_userid?loggedin_userid:"", 320,240, 1,1,0,0,"hou@moet",0,true)
        }else{
          alert('Thông tin đăng nhập không hợp lệ!')
        }
      },
      error: function (xhr){
        alert('Lỗi kết nối đến máy chủ:'+xhr);
      }
    });
  }else{
    loggedin_userid = null
    $('#inp_username').get(0).disabled = false
    $('#inp_password').get(0).disabled = false
    $('#inp_username').get(0).value = ""
    $('#inp_password').get(0).value = ""
    $('#btn_login').get(0).innerHTML = 'Đăng nhập'
    updateImagesTable(loggedin_userid)
    toglleFaceDisplay(loggedin_userid?loggedin_userid:"", 320,240, 1,1,0,0,"hou@moet",0,true)
  }
}
/*-------------------------------------------------*/
function showHideFace() {      
  toglleFaceDisplay(loggedin_userid,320,240, 1,1,0,0,"hou@moet",0,false)
}
/*-------------------------------------------------*/
function showHidePosition() {
  const pimg = $('#img_position').get(0);
  if (pimg.style.display=='none'){
    pimg.style.display = 'inline';
  }else{
    pimg.style.display = 'none';
  }
}
/*-------------------------------------------------*/
