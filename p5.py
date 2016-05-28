import flask
from flask import Flask
import base64
import uuid
import os
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
app.config.from_pyfile('settings.py')

# make the sockets.
socketio = SocketIO(app)
recip_sockets = {}

site_title = 'Battleship'

chats = {}
userList = {}
num_players = {}
room_players = {}  # holds the auth_user id in it for each room.


@app.before_request
def setup_csrf():
    if 'csrf_token' not in flask.session:
        flask.session['csrf_token'] = base64.b64encode(os.urandom(32)).decode('ascii')
    if 'auth_user' not in flask.session:
        flask.session['auth_user'] = base64.b64encode(os.urandom(32)).decode('ascii')
    if 'topic' not in flask.session:
        flask.session['topic'] = '0'
    if 'key' not in flask.session:
        flask.session['key'] = '0'
    if 'room' not in flask.session:
        flask.session['room'] = '0'


@app.route('/')
def index():
    page_title = 'Home'
    return flask.render_template('index.html', page_title=page_title, site_title=site_title)


@app.route('/new-chat', methods=['POST'])
def chat():
    topic = flask.request.form['chat_topic']
    flask.session['topic'] = topic
    # store the topic
    if topic not in chats:
        key = base64.urlsafe_b64encode(uuid.uuid4().bytes)[:12].decode('ascii')
        chats[topic] = key
        flask.session['key'] = key
    else:
        key = chats[topic]
        flask.session['key'] = key

    if key not in userList:
        userList[key] = list()

    if key not in num_players:
        num_players[key] = 0

    if key not in room_players:
        room_players[key] = list()

    return flask.redirect('/'+key, code=303)


@app.route('/rematch/<string:key>')
def rematch(key):
    rematch = key + 'R'
    if rematch not in chats:
        chats[flask.session['topic']] = rematch
        flask.session['key'] = rematch
    else:
        flask.session['key'] = rematch

    if rematch not in userList:
        userList[rematch] = list()

    if rematch not in num_players:
        num_players[rematch] = 0

    if rematch not in room_players:
        room_players[rematch] = list()

    return flask.redirect('/'+rematch, code=303)


@app.route('/display_rooms/all')
def display_all():
    page_title = 'Current Rooms'
    return flask.render_template('room_list.html', page_title=page_title, site_title=site_title, chats=chats, num_players=num_players)


@app.route('/<string:key>')
def room(key):

    found = False
    # see if key exists
    for chat in chats:
        if chats[chat] == key:
            flask.session['topic'] = chat
            flask.session['key'] = key
            found = True

    if not found:
        return flask.render_template('index.html', state='not_found')

    page_title = 'Battle of ' + '"' + flask.session['topic'] + '"'

    if flask.session['auth_user'] in room_players[key]:     # if they try to join a room again.. we say no!
                                                            # and delete that room.
        # delete the room.
        for name in chats.copy():
            if chats[name] == room:
                del chats[name]
        return flask.render_template('index.html', state='bad')
    else:
        room_players[key].append(flask.session['auth_user'])

    if key in userList:
        if userList[key] is not None:
            users = userList[key]
        if userList[key] is None:
            return flask.redirect(flask.url_for('index'))

    if key not in userList:
        return flask.redirect(flask.url_for('index'))  # if no key, we bail to the index page :)

    if num_players[key] == 2:
        return flask.redirect(flask.url_for('full_room', key=key))

    name = flask.session['auth_user']
    topic = flask.session['topic']

    num_players[key] += 1
    player = num_players[key]
    return flask.render_template('chat.html', page_title=page_title, site_title=site_title, key=key, sid=flask.session['csrf_token'],
                                 state='!joined', topic=topic,
                                 name=name, users=users, player=player,)


@app.route('/winner/<string:player>')
def winner_page(player):
    page_title = player + "Has Won!"
    winner = player
    sesh = flask.session['topic']
    key=flask.session['key']
    return flask.render_template('winner.html', page_title=page_title, site_title=site_title, winner=winner, session=sesh, key=key)


@app.route('/loser/<string:player>')
def loser_page(player):
    page_title = player + " Has Lost!"
    loser = player
    sesh = flask.session['topic']
    key = flask.session['key']
    return flask.render_template('loser.html', page_title=page_title, site_title=site_title, loser=loser, session=sesh, key=key)


@app.route('/full_room/<string:key>')
def full_room(key):
    page_title = 'Room:' + key
    return flask.render_template('full_room.html', page_title=page_title, site_title=site_title, key=key)


@socketio.on('chat')
def chat(data):
    user_message = data['name'] + ': ' + data['_message']
    flask.session['room'] = data['room']
    emit('new-message', user_message, broadcast=True, room=flask.session['room'])


@socketio.on('join')
def on_join(data):
    room = data['room']
    join_room(room)
    username = data['username']
    flask.session['room'] = room
    if username == '-987jkl':
        return  # -987jkl is the default user name. we don't wanna do anything.
    username = data['username']
    flask.g.user = username
    flask.session['auth_user'] = username
    join_room(room)
    flask.session['session'] = data['sid']
    userList[room].append(username)
    emit("new-user", username, broadcast=True, room=room)


@socketio.on('leave')
def on_leave(data):
    room = data['room']
    leave_room(room)
    username = data['username']

    # delete the room.
    for name in chats.copy():
        if chats[name] == room:
            del chats[name]

    userList[room].remove(username)
    user_message = 'Sever: ' + username + ' has left the chat.'
    emit('new-message', user_message, broadcast=True, room=flask.session['room'])
    emit('remove-user', username, broadcast=True, room=flask.session['room'])


@socketio.on('move')
def move(data):
    flask.session['room'] = data['room']
    flask.session['curr_player'] = data['curr_player']
    flask.session['sid'] = data['sid']

    emit('move', data, broadcast=True, room=data['room'])


@socketio.on('p2_join')
def p2_join(data):
    emit('p2-join', data, broadcast=True, room=flask.session['key'])


@socketio.on('disconnect')
def leave():
    leave(room)


if __name__ == '__main__':
    socketio.run(app)
