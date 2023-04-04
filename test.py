from flask import Flask, render_template, make_response, request, send_from_directory
app = Flask(__name__)

@app.route('/')
def index():
   user_agent = request.user_agent
   sclient = 'Client address:'
   if request.environ.get('HTTP_X_FORWARDED_FOR') is None:
      sclient += request.environ['REMOTE_ADDR']
   else:
      sclient += request.environ['HTTP_X_FORWARDED_FOR'] # if behind a proxy
   sclient += f';Platform:{user_agent.platform};Browser:{user_agent.browser}'
   return sclient
#    return render_template('index.html', client_request=sclient)
