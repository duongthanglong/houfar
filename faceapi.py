from flask import Flask, render_template, make_response, request, send_from_directory
import base64, cv2, numpy as np, os, glob, datetime, json, datetime, pickle, socket
from flask_mail import Mail, Message

#------------------------------------------------------------#
app = Flask(__name__)

MAX_USERIMAGES = 20
SENDBACK_ALLOWCODE = 'moet@hou@fit'

usersdata = None
usershistory = {} #total of current session & the last history by users
path2userdata = app.root_path+'/userdata'
path2userhistory = app.root_path+'/userhistory'
app_hosting = "https://houfar.onrender.com" if curpath.endswith('render/project/src') else "http://localhost:5000"

mail_settings = {
    "MAIL_SERVER": 'smtp.gmail.com',
    "MAIL_PORT": 465,
    "MAIL_USE_TLS": False,
    "MAIL_USE_SSL": True,
    "MAIL_USERNAME": 'longhlk@gmail.com',
    "MAIL_PASSWORD": '10119Lhlk174'
}
app.config.update(mail_settings)
mail = Mail(app)
##############################################################
###--- THESE ARE ROUTING TASK FOR REQUESTING FROM CLIENT --###
#------------------------------------------------------------#
@app.route('/favicon.ico')
def favicon():
   return send_from_directory(os.path.join(app.root_path,'static/images'),
                              'favicon.ico', mimetype='image/vnd.microsoft.icon')
#------------------------------------------------------------#
@app.route('/filesprocess', methods=['GET','POST'])
def filesprocess():
   if request.method=='GET':
      return render_template('filesprocess.html', app_hosting=app_hosting)
   # elif request.method=='POST':
      
#------------------------------------------------------------#
@app.route('/', methods=['GET'])
def index():
   user_agent = request.user_agent
   sclient = 'Client address: '
   if request.environ.get('HTTP_X_FORWARDED_FOR') is None:
      sclient += request.environ['REMOTE_ADDR']
   else:
      sclient += request.environ['HTTP_X_FORWARDED_FOR'] # if behind a proxy
   sclient += f';Platform: {user_agent.platform};Browser: {user_agent.browser}'
   return render_template('index.html', app_hosting=app_hosting, client_request=sclient)
#------------------------------------------------------------#
@app.route('/face-monitoring/', methods=['GET','POST']) #---> GET là để mở dịch vụ; POST là để cập nhật trạng thái học tập
def face_monitoring():
   global usersdata, usershistory
   if usersdata is None:
      usersdata = load_usersdata()
   # print('*'*20,'len(usersdata)=',len(usersdata),usersdata.keys())
   # print('*'*20,'len(usershistory)=',len(usershistory),usershistory.keys())
   if request.method=='GET': #kiểm tra và mở dịch vụ giám sát học tập
      userid = request.args.get('userid')
      videowidth = request.args.get('videowidth',320)
      videoheight = request.args.get('videoheight',240)
      facebox = request.args.get('facebox',"")
      facelandmark = request.args.get('facelandmark',"")
      faceexpression = request.args.get('faceexpression',"")
      facerecognition = request.args.get('facerecognition',"")
      soundnotify = request.args.get('soundnotify',"")
      requiringcode = request.args.get('requiringcode')  #---> người học đã đăng nhập ở LMS, sau đó LMS gửi request cùng mã bảo vệ tương ứng người học đến để sử dụng dịch vụ này
      data = get_response_userdata(usersdata,userid,requiringcode)
      # print('*'*20,'USERS:'+data['userid'] if data is not None else 'NO.USERS')
      if data is not None: #monitor face with USER (default: requiringcode=='hou@moet', or 'fit@hou@moet' -> allow_sendback history)
         usershistory[data['userid']] = {'total':None,'last':None}
         return render_template('face-monitoring.html', app_hosting=app_hosting, videowidth=videowidth, videoheight=videoheight, 
            userid=data['userid'], descriptors=data['descriptors'], 
            sendback_allowcode=data['sendback_allowcode'],
            facebox=facebox, facelandmark=facelandmark, 
            faceexpression=faceexpression, facerecognition=facerecognition, 
            soundnotify=soundnotify)
      else: #just view face, NO USER for monitoring ---> data=0
         return render_template('face-monitoring.html', app_hosting=app_hosting, videowidth=videowidth, videoheight=videoheight, 
            facebox=facebox, facelandmark=facelandmark, 
            faceexpression=faceexpression, facerecognition=facerecognition, 
            soundnotify=soundnotify)
   else: #request.method=='POST': #receive user history of face-monitoring
      if request.form['userid'] in usershistory.keys() and request.form['sendback_allowcode']==SENDBACK_ALLOWCODE: #update history of user
         userid = request.form['userid']
         milisc = int(request.form['miliseconds'])
         dtime1 = datetime.datetime.fromtimestamp(milisc/1000.0) #.strftime("%d/%m/%Y-%H:%M:%S")
         dtime2 = datetime.datetime.now() #.strftime("%d/%m/%Y-%H:%M:%S")
         deltim = dtime2-dtime1
         recuid = request.form['label']
         simila = float(request.form['similarity'])
         expres = request.form['expression']
         escore = float(request.form['score'])
         '''
            fh = open(f'{path2userhistory}/{userid}_{dtime2.strftime("%Y%m%d")}.txt','a')
            fh.write(f'{dtime1.strftime("%d/%m/%Y-%H:%M:%S:%f")[:-3]};+{deltim.seconds}.{deltim.microseconds};{recuid};{simila:.3f};{expres};{escore:.3f}\n')
            fh.close()
         '''
         usershistory[userid]['last'] =   {  'ctime': dtime1.strftime("%d/%m/%Y-%H:%M:%S:%f")[:-3] if milisc>0 else '',
                                             'dtime': f'{deltim.seconds}.{deltim.microseconds/10:.0f}' if milisc>0 else '',
                                             'recognized': recuid,
                                             'similarity': f'{simila:.3f}',
                                             'expression': expres,
                                             'score':f'{escore:.3f}'
                                          }
         if usershistory[userid]['total'] is None:
            usershistory[userid]['total'] = {'count':1,
                                             'count_nonface':1 if recuid=='' else 0,
                                             'similarity':simila,
                                             'expressions':{expres:{'count':1,'score':escore}}
                                             }
         else:
            usershistory[userid]['total']['count'] += 1
            usershistory[userid]['total']['count_nonface'] += 1 if recuid=='' else 0
            usershistory[userid]['total']['similarity'] += simila
            if expres not in usershistory[userid]['total']['expressions'].keys():
               usershistory[userid]['total']['expressions'][expres] = {'count':1,'score':escore}
            else:
               usershistory[userid]['total']['expressions'][expres]['count'] += 1
               usershistory[userid]['total']['expressions'][expres]['score'] += escore
         '''--- Save userhistory to file ---'''
         '''with open(f'{path2userhistory}/{userid}_last_total.txt','wb') as fh:
            pickle.dump(usershistory, fh)
            fh.close()
         '''
         return {'results':True}
      else:
         return {'results':False}
#------------------------------------------------------------#
@app.route('/lms-testing/', methods=['GET'])
def lms_testing():
   return render_template('lms-testing.html', app_hosting=app_hosting)
#------------------------------------------------------------#
@app.route('/lms-monitoring/', methods=['GET','POST'])
def lms_monitoring():
   global usersdata, usershistory
   if usersdata is None:
      usersdata = load_usersdata()
   # print('*'*20,'len(usershistory)=',len(usershistory),usershistory.keys())   
   if request.method=='GET':
      return render_template('lms-monitoring.html', app_hosting=app_hosting)
   else: #POST ---> send history of users to client
      if 'userid_prefix' in request.form:
         userid_prefix = request.form['userid_prefix']
         uhist = {}
         for uid in usershistory.keys():
            if uid.startswith(userid_prefix):
               uhist[uid] = usershistory[uid]         
         return {'results':True, 'history': uhist}
      return {'results':False} 
#------------------------------------------------------------#
@app.route('/capturing/', methods=['GET','POST'])
def capturing():
   global usersdata
   if usersdata is None:
      usersdata = load_usersdata()
      # print('*'*20,f'Loading:{len(usersdata)} students')
   if request.method=='GET': #mở dịch vụ đăng ký và chụp ảnh
      return render_template('capturing.html', app_hosting=app_hosting,  num_students=len(usersdata))
   else: # request.method=='POST': # ---> login/save images      
      uid = request.form['userid']
      if 'userpass' in request.form: #login
         pas = request.form['userpass']
         #check user_id = uid && user_password = pas?
         results = uid in usersdata.keys() and (pas==uid+'@HOU'+uid[2:] if uid[:2]=='sv' else pas==uid+'@HOU')
         # print('*'*20,f'Login:{uid}/{pas}--->{results}')
         return {'results':results}
      elif uid in usersdata.keys(): #already registered & logged-in => save images
         pos = request.form['position']
         user_desciptor = request.form['descriptor']
         user_desciptor = np.array(user_desciptor.split(','),dtype='float')
         # print('pos=',pos,'\ndescriptor=',user_desciptor)
         # print('image data=',request.form['img'])
         img_bin = base64.b64decode(request.form['img'])
         #jpg <- binary
         img_jpg=np.frombuffer(img_bin, dtype=np.uint8)
         #raw image <- jpg
         img = cv2.imdecode(img_jpg, cv2.IMREAD_COLOR)
         # img = cv2.flip(img,1) - already flip from client
         #Filepath to save the decoded image
         img_file = uid+'_'+pos+'.jpg' #datetime.datetime.now().strftime('%Y%m%d%H%M%S_%f')+'.jpg'
         user_path = f'{path2userdata}/{uid}'
         if not os.path.exists(user_path):
            os.mkdir(user_path)      
         #Save image & add to userdata
         user_path2img = f'{user_path}/{img_file}'
         cv2.imwrite(user_path2img, img)
         user_path2des = user_path2img[:-3]+'npy'
         np.save(user_path2des, user_desciptor)
         usersdata = add_userdata(usersdata, uid, user_path2img, user_desciptor)
         # print('*'*20,f'Saved images:uid={uid}/pos={pos}/image-file={user_path2img}/descriptor-file={user_path2des}')
         return {'results':True, 'savedfile':f'{uid}/{img_file}'}
      else:
         # print('*'*20,'NO users in the DATA:',uid)
         return {'results':False}
#------------------------------------------------------------#
@app.route('/capturing/<path:path>') #for getting a file by path from client (user picture)
def capturing_path(path):
   if os.path.exists(app.root_path+f'/userdata/{path}'):
      return send_from_directory(app.root_path+'/userdata', path)
   else:
      return make_response('')
#------------------------------------------------------------#
@app.route('/register/<string:email>') #for sending email to users
def register_email_sending(email):
   with app.app_context():
      msg = Message( subject="Hello",
                     sender=app.config.get("MAIL_USERNAME"),
                     recipients=[email],
                     body="Send email from Flask")
      mail.send(msg)
   return make_response("Email sent")

##############################################################
###------- THESE ARE FOR PROCESSING ON SERVER SIDE --------###
#------------------------------------------------------------#
def get_response_userdata(usersdata, userid, requiringcode):
   if not check_requiringcode(requiringcode):
      return None
   if userid is not None and usersdata is not None and userid in usersdata.keys():
      #each user: array of image-files, array of desciptors for every image-files
      des = ''
      if usersdata[userid]['descriptors'] is not None and len(usersdata[userid]['descriptors'])>0:
         des = "#".join([';'.join(e) for e in usersdata[userid]['descriptors'].astype(str)]) 
      return { 'userid':userid, 
               # 'imagefiles': usersdata[userid]['images'], 
               'descriptors': des,
               'sendback_allowcode': get_sendback_allowcode(requiringcode) }
   else:
      return None
def check_requiringcode(requiringcode):
   return requiringcode in ['hou@moet','fit@hou@moet'] #fit@hou@moet = allow send back history
def get_sendback_allowcode(requiringcode):
   return SENDBACK_ALLOWCODE if requiringcode=='fit@hou@moet' else ''
#------------------------------------------------------------#
def add_userdata(usersdata, u_name, u_imgfile, u_desc): #usersdata = {user_name_id contains {image-files, descriptors}}
   if usersdata is None:
      usersdata = {}
   up = path2userdata+f'/{u_name}'
   u_imgfile = None if u_imgfile is None else np.array([u_imgfile])
   u_desc = None if u_desc is None else np.array([u_desc])
   if u_name not in usersdata.keys():
      usersdata[u_name] = {'images':u_imgfile, 'descriptors':u_desc}
   else:
      if u_imgfile is not None and u_desc is not None:
         if usersdata[u_name]['images'] is None:
            usersdata[u_name]['images'] = u_imgfile
            usersdata[u_name]['descriptors'] = u_desc
         elif len(usersdata[u_name]['images'])<MAX_USERIMAGES:
            usersdata[u_name]['images'] = np.vstack((usersdata[u_name]['images'], u_imgfile))
            usersdata[u_name]['descriptors'] = np.vstack((usersdata[u_name]['descriptors'], u_desc))
         else:
            print(f'#Server: CANNOT add IMAGES of USER, user {u_name} reach MAX={MAX_USERIMAGES}')
      else:
         print(f'#Server: CANNOT add IMAGES of USER, reach MAX={MAX_USERIMAGES}')
   return usersdata
#------------------------------------------------------------#
def load_usersdata(): #usersdata = {user_name_id contains {image-files,descriptor}}
   usersdata = {}
   usrpath = glob.glob(path2userdata+'/*/')
   if len(usrpath)>0:
      for up in usrpath:
         u_name = os.path.split(up[:-1])[1]
         usersdata = add_userdata(usersdata, u_name, None, None)
         #get all desciptors file (*.npy) of an user
         desfile = glob.glob(up+'*.npy')
         for desf in desfile:
            imgf = desf[:-3]+'jpg'            
            if os.path.exists(imgf):
               usersdata = add_userdata(usersdata, u_name, imgf, np.load(desf))
            else:
               print(f'#Server: DESCIPTOR of USER={u_name} DOES NOT have IMAGES file={imgf}')
      print('#Server: number of users=', len(usersdata))
   else:
      print(f'#Server: NO USERS in the path={path2userdata}')
   return usersdata

##############################################################
if __name__ == '__main__':
   # app.run(host = "192.168.1.176", ssl_context=('cert.pem','key.pem'), debug=True)
   # usersdata = load_usersdata()
   # print(app.config)
   app.run() #debug=True)

