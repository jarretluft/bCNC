/*

    GRBLWeb - a web based CNC controller for GRBL
    Copyright (C) 2015 Andrew Hodel

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
    WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
    MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
    ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
    WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
    ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
    OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

$(document).ready(function() {

	$( window ).resize(function() {
		// when header resizes, move ui down
		$('.table-layout').css('margin-top',$('.navbar-collapse').height()-34);
	});

	var socket = new WebSocket("ws://" + document.domain + ":9001/");

	// socket.on('serverError', function (data) {
	// 	alert(data);
	// });
	
	//emulate the socket.io emit function so that I don't have to re-write all the code below.
	socket.emit = function(first, second) {
		if(second["line"] !== undefined){
			$('#console').append(second["line"]+"\n");
			$('#console').scrollTop($("#console")[0].scrollHeight - $("#console").height());
		}
		var output = {};
		output[first] = second;
		socket.send(JSON.stringify(output));
	};
	socket.onopen = function() {
		console.log("WS: onopen");
		$("#ws-status").toggleClass("led-red led-green");
		$("#ws-status").prop('title', 'Server Online');
	    socket.emit('portList',1); //request initial port list
	};
	socket.onmessage = function(e) {
		// e.data contains received string.
		console.log("WS: onmessage: " + e.data);
		parseMessage(e.data);
	};
	socket.onclose = function() {
		console.log("WS: onclose");
		$("#ws-status").toggleClass("led-red led-green");
		$("#ws-status").prop('title', 'Server Offline');
	};
	socket.onerror = function(e) {
		console.log("WS: onerror");
		console.log(e)
	};

	var parseMessage = function(msg){
		data = JSON.parse(msg);
		console.log(data);

		switch(data.cmd){
			case "machineStatus":
				data = data.arr;

				if($('#mStatus').html() !== data.state){
					$('#mStatus').html(data.state);
					if(data.state !== "Not connected"){
						$('#mConnectPort').css('display','none');
						$('#mConnectBaud').css('display','none');
						$('#mConnectButton').css('display','none');
						$('#mDisconnectButton').css('display','inline');
					}else{
						$('#mConnectPort').css('display','inline');
						$('#mConnectBaud').css('display','inline');
						$('#mConnectButton').css('display','inline');
						$('#mDisconnectButton').css('display','none');
					}
				}

				$('#mX').html('X: '+data.mx);
				$('#mY').html('Y: '+data.my);
				$('#mZ').html('Z: '+data.mz);
				$('#wX').html('X: '+data.wx);
				$('#wY').html('Y: '+data.wy);
				$('#wZ').html('Z: '+data.wz);
			 	break;

			case "machineSettings":
	    		var settingHtml = '<pre>';
				data.forEach(function(setting) {
					settingHtml += '<span>'+setting+'</span>';
				});
				$('#settings').find('.modal-body').html(settingHtml+'</pre>');
				$('#extraSettings').show();
				break;

			case "serialRead":
				if ($('#console p').length > 300) {
					// remove oldest if already at 300 lines
					$('#console p').first().remove();
				}
	    		$('#console').append(data.line);
				$('#console').scrollTop($("#console")[0].scrollHeight - $("#console").height());
				break;

			case "qStatus":
				$('#qStatus').html(data.currentLength+'/'+data.currentMax);
				break;

			case "portList":
				$.each(data.ports, function(key, value) {
				     $('#mConnectPort')
				         .append($("<option></option>")
				         .attr("value",value)
				         .text(value));
				});

			case "config":
				break;
			case "gcodeFromJscut":
				break;
			default:
				break;

		}
	};

	$('#choosePort').on('change', function() {
		// select port
		socket.emit('usePort', $('#choosePort').val());
		$('#mStatus').html('Port Selected');
	})

	$('#mConnectButton').on('click', function() {
		socket.emit('usePort',{'port': $('#mConnectPort').val(), 'baud': $('#mConnectBaud').val()});
	});

	$('#mDisconnectButton').on('click', function() {
		socket.emit('command','CLOSE');
	});

	$('#sendReset').on('click', function() {
		socket.emit('command', 'RESET');
	});

	$('#sendGrblHelp').on('click', function() {
		socket.emit('gcodeLine', { line: '$' });
	});

	$('#sendGrblSettings').on('click', function() {
		socket.emit('gcodeLine', { line: '$$' });
	});

	$('#pause').on('click', function() {
		if ($('#pause').html() == 'Pause') {
			// pause queue on server
			socket.emit('pause', 1);
			$('#pause').html('Unpause');
			$('#clearQ').removeClass('disabled');
		} else {
			socket.emit('pause', 0);
			$('#pause').html('Pause');
			$('#clearQ').addClass('disabled');
		}
	});

	$('#clearQ').on('click', function() {
		// if paused let user clear the command queue
		socket.emit('clearQ', 1);
		// must clear queue first, then unpause (click) because unpause does a sendFirstQ on server
		$('#pause').click();
	});

	$('#mpC').on('click', function() {
		$('#mpA').addClass('active');
		$('#wpA').removeClass('active');
		$('#mPosition').show();
		$('#wPosition').hide();
	});

	$('#wpC').on('click', function() {
		$('#wpA').addClass('active');
		$('#mpA').removeClass('active');
		$('#wPosition').show();
		$('#mPosition').hide();
	});

	$('#sendZero').on('click', function() {
		socket.emit('gcodeLine', { line: 'G92 X0 Y0 Z0' });
	});

	$('#sendCommand').on('click', function() {

		socket.emit('gcodeLine', { line: $('#command').val() });
		$('#command').val('');

	});

	// shift enter for send command
	$('#command').keydown(function (e) {
		if (e.shiftKey) {
			var keyCode = e.keyCode || e.which;
			if (keyCode == 13) {
				// we have shift + enter
				$('#sendCommand').click();
				// stop enter from creating a new line
				e.preventDefault();
			}
		}
	});

	$('#xM').on('click', function() {
		socket.emit('gcodeLine', { line: 'G91\nG1 F'+$('#jogSpeed').val()+' X-'+$('#jogSize').val()+'\nG90'});
	});
	$('#xP').on('click', function() {
		socket.emit('gcodeLine', { line: 'G91\nG1 F'+$('#jogSpeed').val()+' X'+$('#jogSize').val()+'\nG90'});
	});
	$('#yP').on('click', function() {
		socket.emit('gcodeLine', { line: 'G91\nG1 F'+$('#jogSpeed').val()+' Y'+$('#jogSize').val()+'\nG90'});
	});
	$('#yM').on('click', function() {
		socket.emit('gcodeLine', { line: 'G91\nG1 F'+$('#jogSpeed').val()+' Y-'+$('#jogSize').val()+'\nG90'});
	});
	$('#zP').on('click', function() {
		socket.emit('gcodeLine', { line: 'G91\nG1 F'+$('#jogSpeed').val()+' Z'+$('#jogSize').val()+'\nG90'});
	});
	$('#zM').on('click', function() {
		socket.emit('gcodeLine', { line: 'G91\nG1 F'+$('#jogSpeed').val()+' Z-'+$('#jogSize').val()+'\nG90'});
	});

	// WASD and up/down keys
	$(document).keydown(function (e) {
		var keyCode = e.keyCode || e.which;

		if ($('#command').is(':focus')) {
			// don't handle keycodes inside command window
			return;
		}

		switch (keyCode) {
		case 65:
			// a key X-
			e.preventDefault();
			$('#xM').click();
			break;
		case 68:
			// d key X+
			e.preventDefault();
			$('#xP').click();
			break;
		case 87:
			// w key Y+
			e.preventDefault();
			$('#yP').click();
			break;
		case 83:
			// s key Y-
			e.preventDefault();
			$('#yM').click();
			break;
		case 38:
			// up arrow Z+
			e.preventDefault();
			$('#zP').click();
			break;
		case 40:
			// down arrow Z-
			e.preventDefault();
			$('#zM').click();
			break;
		}
	});

	// handle gcode uploads
	if (window.FileReader) {

		var reader = new FileReader ();

		// drag and drop
		function dragEvent (ev) {
			ev.stopPropagation (); 
			ev.preventDefault ();
			if (ev.type == 'drop') {
				reader.onloadend = function (ev) {
					document.getElementById('command').value = this.result;
					openGCodeFromText();
				};
				reader.readAsText (ev.dataTransfer.files[0]);
			}  
		}

		document.getElementById('command').addEventListener ('dragenter', dragEvent, false);
		document.getElementById('command').addEventListener ('dragover', dragEvent, false);
		document.getElementById('command').addEventListener ('drop', dragEvent, false);

		// button
		var fileInput = document.getElementById('fileInput');
		fileInput.addEventListener('change', function(e) {
			reader.onloadend = function (ev) {
				document.getElementById('command').value = this.result;
				openGCodeFromText();
			};
			reader.readAsText (fileInput.files[0]);
		});

	} else {
		alert('your browser is too old to upload files, get the latest Chromium or Firefox');
	}

});
