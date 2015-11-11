# -*- coding: latin1 -*-
# $Id: CNCPendant.py,v 1.3 2014/10/15 15:04:48 bnv Exp bnv $
#
# Author:	Vasilis.Vlachoudis@cern.ch
# Date:	06-Oct-2014

__author__ = "Vasilis Vlachoudis"
__email__  = "Vasilis.Vlachoudis@cern.ch"

import os
import sys
#import cgi
import json
import threading
import urllib
from websocket_server import WebsocketServer

try:
	from serial.tools.list_ports import comports
except:
	from Utils import comports

try:
	import urlparse
except ImportError:
	import urllib.parse as urlparse

try:
	import BaseHTTPServer as HTTPServer
except ImportError:
	import http.server as HTTPServer

HOSTNAME = "localhost"
port = 8080
httpd = None
#prgpath = os.path.abspath(os.path.dirname(sys.argv[0])+'/grblweb')
prgpath = os.path.abspath(os.getcwd()+'/grblweb') #this method seems to work better on python3/mac - argv[0] is empty

ws_server = None
ws_port = 9001

#==============================================================================
# Simple Pendant controller for CNC
#==============================================================================
class Pendant(HTTPServer.BaseHTTPRequestHandler):
	#----------------------------------------------------------------------
	def log_message(self, fmt, *args):
		# Only requests to the main page log them, all other ignore
		if args[0].startswith("GET / "):
			HTTPServer.BaseHTTPRequestHandler.log_message(self, fmt, *args)

	#----------------------------------------------------------------------
	def do_HEAD(self, rc=200, content="text/html"):
		self.send_response(rc)
		self.send_header("Content-type", content)
		self.end_headers()

	#----------------------------------------------------------------------
	def do_GET(self):
		"""Respond to a GET request."""

		page = self.path
		arg = None

		self.mainPage(page[1:])
		
	# ---------------------------------------------------------------------
	def mainPage(self, page):
		global prgpath

		#handle certain filetypes
		filetype = page.rpartition('.')[2]
		if filetype == "css": self.do_HEAD(content="text/css")
		elif filetype == "js": self.do_HEAD(content="text/javascript")
		else: self.do_HEAD()

		if page == "": page = "index.html"
		try:
			f = open(os.path.join(prgpath,page),'r')
			self.wfile.write(f.read())
			f.close()
		except IOError:
			self.wfile.write("""<!DOCTYPE html>
<html>
<head>
<title>Errortitle</title>
<meta name="viewport" content="width=device-width,initial-scale=1, user-scalable=yes" />
</head>
<body>
Page not found.
</body>
</html>
""")

# HANDLE WEBSOCKET COMMUNICATION
# -----------------------------------------------------------------------------
# receive message from client
def ws_receive(client, server, message):
	data = json.loads(message) #assume all messages from client are JSON format

	#handle result, for now just dump to cmd line
	#this should be auto-pushed when queried
	#if data['cmd'] == "machineStatus":
	#	ws_send(json.dumps(httpd.app._pos))

	print(data)

	try:
		for line in data['gcodeLine']['line'].split('\n'):
			#httpd.app.queue.put(line+"\n")
			httpd.app.queue.put(line+"\n")
	except KeyError: #response was not a gcodeLine
		try:
			httpd.app.queue.put(data['command'])
		except KeyError: #response was not a command
			try:
				if data['portList'] == 1:
					ws_send(json.dumps({"cmd":"portList", "ports" : sorted([x[0] for x in comports()])}))
			except KeyError: #response was not requesting a port list
				try:
					device  = data['usePort']['port']
					baudrate = int(data['usePort']['baud'])
					if httpd.app.serial is None:
						if httpd.app.open(device, baudrate):
							httpd.app.connectBtn.config(text="Close",
									background="Salmon",
									activebackground="Salmon")
							httpd.app.enable()
				except KeyError: #response was not requesting to connect to a port
					print("Unknown Command!")

# send message to all connected clients
def ws_send(msg):
	global ws_server
	try:
		print(msg)
		ws_server.send_message_to_all(msg)
	except:
		ws_server = None

# HTTP SERVER INITIALIZATION
# -----------------------------------------------------------------------------
def _server(app):
	global httpd
	server_class = HTTPServer.HTTPServer
	
	try:
		httpd = server_class(('', port), Pendant)
		httpd.app = app
		httpd.serve_forever()
	except:
		httpd = None

# WEBSOCKET SERVER INITIALIZATION
# -----------------------------------------------------------------------------
def _wsServer():
	global ws_server
	ws_server_class = WebsocketServer

	try:
		ws_server = ws_server_class(ws_port, host="0.0.0.0")
		ws_server.set_fn_message_received(ws_receive) #set receiving function
		ws_server.run_forever() #start ws server
	except:
		ws_server = None

# -----------------------------------------------------------------------------
def start(app):
	global httpd
	global ws_server

	if httpd is not None or ws_server is not None: return False
	
	http_thread = threading.Thread(target=_server, args=(app,))
	http_thread.start()

	ws_thread = threading.Thread(target=_wsServer)
	ws_thread.start()

	return True

# -----------------------------------------------------------------------------
def stop():
	global httpd
	global ws_server
	if httpd is None or ws_server is None: return False
	
	httpd.shutdown()
	httpd = None
	
	ws_server.server_close()
	ws_server = None
	return True

if __name__ == '__main__':
	start()
