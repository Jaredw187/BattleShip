//99
var socket = io('http://' + document.domain + ':' + location.port);
var object = $(".window");
var room = object.attr("data-key");
var session = object.attr("data-sid");
var username = '-987jkl'; //random value to add on connect. wil be replaced when user enters nickname
var player_id = document.getElementById("curr_pid").innerHTML;

/************************************
    THE CHAT
*************************************/
// hide it all. its super secret.
document.getElementById('board_wrapper_p1').style.display = 'none';
document.getElementById('board_wrapper_p2').style.display = 'none';
document.getElementById('input').style.display = 'none';
document.getElementById('theMessages').style.display = 'none';
document.getElementById('theMsgsInput').style.display = 'none';
document.getElementById('theList').style.display = 'none';
document.getElementById('boardfeildsetp1').style.display = 'none';
document.getElementById('boardfeildsetp1moves').style.display = 'none';
document.getElementById('boardfeildsetp2').style.display = 'none';
document.getElementById('boardfeildsetp2moves').style.display = 'none';
document.getElementById('ship_status').style.display = 'none';
document.getElementById('join_chat').style.display = 'none';
document.getElementById('join_chat_dialogue').style.display = 'none';
document.getElementById("join_chat_dialogue").innerHTML = "Join the Chat to Play!";
// if player is player two.. let everyone  
if (player_id == 2){
    socket.emit("p2_join", {
        message: "p2 join",
        room: room,
        sid: session
    });
    document.getElementById('waiting_dialogue').style.display = 'none';
    
    document.getElementById('join_chat').style.display = 'initial';

    document.getElementById('join_chat_dialogue').style.display = 'initial';
}
// create user names
$(".nameInput").on("submit", function(action) {
    action.preventDefault();
    var name = $("#userName").val();
    username = name;
    if (!username) return;
    if (name) {
        socket.emit('join', {
            username: name,
            room: room,
            sid: session
        });
        // after nickname input, hide the form
        document.getElementById("join_chat").style.display = 'none';
        document.getElementById("card_nickname").style.display = 'none';
        //hide and seek is over :(
        document.getElementById('input').style.display = 'initial';
        document.getElementById('theMessages').style.display = 'initial';
        document.getElementById('theMsgsInput').style.display = 'Initial';
        document.getElementById('theList').style.display = 'initial';
        document.getElementById("join_chat_dialogue").innerHTML = "Chat";
        
        if (player_id == 1) {
            document.getElementById('boardfeildsetp1').style.display = 'initial';
            document.getElementById('boardfeildsetp1moves').style.display = 'initial';
            document.getElementById('board_wrapper_p1').style.display = 'initial';
        }
        if (player_id == 2) {
            document.getElementById('boardfeildsetp2').style.display = 'initial';
            document.getElementById('boardfeildsetp2moves').style.display = 'initial';
            document.getElementById('board_wrapper_p2').style.display = 'initial';
        }
        document.getElementById('ship_status').style.display = 'initial';

    }
});
// create and append messages
$(".input").on("submit", function(action) {
    action.preventDefault();
    // get the message as well as set the field to null
    var message = $("#message").val();
    var name = $("#userName").val();
    if (!message)//if no message, we bail.
        return;
    if (!name)// if no name, we bail.
        return;
    message = '(p' + player_id + ') ' + message;
    socket.emit("chat", {
        sid: session,
        room: room,
        _message: message,
        name: name
    });
     //reset the text field
    $("#message").val("");
    //change the text
});
// enter the room on connect (still un-named)
socket.on('connect', function() {
    console.log("connected");
    socket.emit('join', {
            username: '-987jkl',  // random val.
            room: room,
            sid: session
        });
});
// add a new message to the list.
socket.on("new-message", function(action) {
    //$(".messages").append('<img src="' + '/static/gamepieces/alive/battleship_alive.png' +'" alt="" height="30" width="30">' + ' ' + action +'<br>');
    $("<ul>").addClass("text").text(action).appendTo($(".messages"))
    // $("<ul>").('<img src="' + '/static/gamepieces/alive/battleship_alive.png' +'" alt="" height="20" width="20">' + ' ' + action +'\n').appendTo($(".messages"))
});
// add a user to the list.
socket.on("new-user", function(action) {
    $("<ul>").text('Server: ' + action).append(" has joined the chat!").appendTo($(".messages"));
    $("<ul>").addClass(action).text(action).appendTo($(".userList"))
});
// remove a user from the list.
socket.on("remove-user", function(action) {
    $("."+action).remove();
    document.getElementById('input').style.display = 'none';
    document.getElementById('theMessages').style.display = 'none';
    document.getElementById('theList').style.display = 'none';
    document.getElementById('theMsgsInput').style.display = 'none';
    document.getElementById('boardfeildsetp1').style.display = 'none';
    document.getElementById('boardfeildsetp1moves').style.display = 'none';
    document.getElementById('boardfeildsetp2').style.display = 'none';
    document.getElementById('boardfeildsetp2moves').style.display = 'none';
    document.getElementById('ship_status').style.display = 'none';
    document.getElementById("the_chat_app").style.display = 'none';
    document.getElementById("game_info").innerHTML = "Opposing Player has Left, Game Over!";
});

/************************************
    THE GAME
*************************************/
var started = false;
var count = 1; // represents the number of boats the user has on the board.
var curr_player = 1; //represents whose turn it is.
var winner;
var p1_set = false;
// arrays to store the hits :)
var p1boats = [0,0,0,0,0];
var p2boats = [0,0,0,0,0];
// for ship placement error checking
var prev_row;
var prev_col;
var safe = true;
var first_placement = true;
var second_placement = false;
var rest_placement = false;
var vertical = false;
var horizontal = false;
var boat = 'carrier';
var boat_length = 0;
var info_string = 'Player 1: ';

// respond to clicks in the cells
$('.cell').on('click', function() {
    if (player_id == curr_player) {
        var row = parseInt($(this).parent().attr('data-row'));
        var col = parseInt($(this).attr('data-col'));
        if (started == true) {
            update(row, col, curr_player); // PLOT A MOVE if one is found
        }
        else {
            choose_spots(row, col, curr_player, boat);
        }
    }
});
// choose the initial spots on the board
function choose_spots(row, col, player){

    var player_string;
    if (player == 1) player_string = "p1";
    else player_string = "p2";

    className = document.getElementById(""+player_string+row+col).className;

    // if spots taken.. we don't over write it.
    if (className == 'cell') {

        // if its the initial placement of that type of ship.. ignore all below cases
        if (first_placement) {
            safe = true;
            prev_row = row;
            prev_col = col;
            first_placement = false;
            vertical = false;
            horizontal = false;
            boat_length++;
        }
        else if (vertical == false && horizontal == false && first_placement == false){
            if ((row == prev_row - 1 && col == prev_col) || (row == prev_row + 1 && col == prev_col)){ // denotes a vertical boat
                safe = true;
                prev_row = row;
                prev_col = col;
                vertical = true;
                rest_placement = true;
                boat_length++;

            }else if ((row == prev_row && col == prev_col - 1) || (row == prev_row && col == prev_col + 1)){ // denotes a horizontal boat
                safe = true;
                prev_row = row;
                prev_col = col;
                horizontal = true;
                rest_placement = true;
                boat_length++;
            }else{
                safe = false; // invalid move. don't place it.
            }
        }
        // if its a horizontal boat go here :)
        else if (horizontal){

            if (((row == prev_row && col == prev_col - boat_length ) && (document.getElementById(""+player_string+(row)+(col + 1)).className == 'cell '+boat))||
                 (row == prev_row && col == prev_col - 1 ) ||
                ((row == prev_row && col == prev_col + boat_length ) && (document.getElementById(""+player_string+(row)+(col - 1)).className == 'cell '+boat))||
                 (row == prev_row && col == prev_col + 1 ) ){
                safe = true;
                prev_row = row;
                prev_col = col;
                horizontal = true;
                boat_length++;
            } else {
                safe = false; // invalid move. don't place it.
            }
        }
        // if its a vertical boat go here :)
        else if (vertical){

            if (((row == prev_row - boat_length && col == prev_col) && (document.getElementById(""+player_string+(row+1)+(col)).className == 'cell '+boat)) ||
                 (row == prev_row - 1 && col == prev_col) ||
                ((row == prev_row + boat_length && col == prev_col) && (document.getElementById(""+player_string+(row-1)+(col)).className == 'cell '+boat)) ||
                 (row == prev_row + 1 && col == prev_col)){
                safe = true;
                prev_row = row;
                prev_col = col;
                vertical = true;
                boat_length++;
            } else {
                safe = false; // invalid move. don't place it.
            }
        }
        // if we pass all cases, mark the spot on the map :)
        if (safe) {

            if (count < 6) {  // 2,3,4,5,6
                document.getElementById("game_info").innerHTML = info_string+"Choose 5 Sequential Locations for your Carrier";
                $('#' + player_string + row + col).addClass('carrier');
                if (count == 5) {
                    document.getElementById("game_info").innerHTML = info_string+"Choose 4 Sequential Locations for your Battleship";
                    first_placement = true; second_placement = false; rest_placement = false;
                    boat = 'battleship'; boat_length = 0;
                }
            }
            if (count >= 6 && count < 10) {  // 7,8,9,10
                $('#' + player_string + row + col).addClass('battleship');
                if (count == 9){
                    document.getElementById("game_info").innerHTML = info_string+"Choose 3 Sequential Locations for your Submarine";
                    first_placement = true; second_placement = false; rest_placement = false;
                    boat = 'submarine'; boat_length = 0;
                }
            }
            if (count >= 10 && count < 13) { // 11,12,13
                $('#' + player_string + row + col).addClass('submarine');
                if (count == 12) {
                    document.getElementById("game_info").innerHTML = info_string+"Choose 3 Sequential Locations for your Destroyer";
                    first_placement = true; second_placement = false; rest_placement = false;
                    boat = 'destroyer'; boat_length = 0;
                }
            }
            if (count >= 13 && count < 16) { // 14,15,16
                $('#' + player_string + row + col).addClass('destroyer');
                if (count == 15){
                    document.getElementById("game_info").innerHTML = info_string+"Choose 2 Sequential Locations for your Patrol Boat";
                    first_placement = true; second_placement = false; rest_placement = false;
                    boat = 'patrol_boat'; boat_length = 0;
                }
            }
            if (count >= 16 && count < 18) {  //17,18
                $('#' + player_string + row + col).addClass('patrol_boat');
                if (count == 17) {
                    first_placement = true; second_placement = false; rest_placement = false;
                    boat = 'carrier'; boat_length = 0;
                }
            }
            count++;
            socket.emit('move', {
                room: room,
                sid: session,
                x: row,
                y: col,
                curr_player: curr_player,
                type: 'set_ship'
            });

            if (count == 18) {
                if (p1_set) {
                    started = true;
                    turn(curr_player);
                }
                else {
                    count = 1;
                    turn(curr_player);
                    p1_set = true;
                    info_string = 'Player 2: ';
                    document.getElementById("game_info").innerHTML = "Player 2: Choose 5 Sequential Locations for your Carrier";
                }

            }
        }
    }
}
// update the cells on the board.
function update(row, col, player) {
    var player_string; var opposing;
    if (player == 1) player_string = "p1";
    else player_string = "p2";
    // switch them up so it interacts with other board.
    if (player == 1) opposing = "p2";
    else opposing = "p1";

    className = document.getElementById(""+opposing+row+col).className;
    if (className == 'cell' || className == 'cell carrier' || className == 'cell battleship' ||
        className == 'cell submarine' || className == 'cell destroyer' || className == 'cell patrol_boat') {

        if ($('#' + opposing + row + col).hasClass('carrier')) {                              // if enemy has boat at these coordinates
            $('#' + player_string + 'm' + row + col).removeClass('carrier').addClass('hit');  // add a hit marker to your moves board at these coordinates
            $('#' + opposing + row + col).removeClass('carrier').addClass('carrier_s');       // make the enemy's boat display as hit on their board.
            update_table(curr_player, 'c', 0);
            count--;
        } else if ($('#' + opposing + row + col).hasClass('battleship')) {
            $('#' + player_string + 'm' + row + col).removeClass('battleship').addClass('hit');
            $('#' + opposing + row + col).removeClass('battleship').addClass('battleship_s');
            update_table(curr_player, 'b', 1);
            count--;
        } else if ($('#' + opposing + row + col).hasClass('submarine')) {
            $('#' + player_string + 'm' + row + col).removeClass('submarine').addClass('hit');
            $('#' + opposing + row + col).removeClass('submarine').addClass('submarine_s');
            update_table(curr_player, 's', 2);
            count--;
        } else if ($('#' + opposing + row + col).hasClass('destroyer')) {
            $('#' + player_string + 'm' + row + col).removeClass('destroyer').addClass('hit');
            $('#' + opposing + row + col).removeClass('destroyer').addClass('destroyer_s');
            update_table(curr_player, 'd', 3);
            count--;
        } else if ($('#' + opposing + row + col).hasClass('patrol_boat')) {
            $('#' + player_string + 'm' + row + col).removeClass('patrol_boat').addClass('hit');
            $('#' + opposing + row + col).removeClass('patrol_boat').addClass('patrol_boat_s');
            update_table(curr_player, 'p', 4);
            count--;
        }
        else {
            $('#' + player_string + 'm' + row + col).addClass('splash'); // add a splash to the moves board
            $('#' + opposing + row + col).addClass('splash'); // add a splash to the boats board of opponent
        }
        socket.emit('move', {
            room: room,
            sid: session,
            x: row,
            y: col,
            curr_player: curr_player,
            type: 'move'
        });
        turn(curr_player);  // change player.
        winner = check_winner();
        if (winner != 'null') {
            if (winner == "Player1") loser = "Player2";
            if (winner == "Player2") loser = "Player1";
            win_redirect = "/winner/" + winner;
            lose_redirect = "/loser/" + loser;

            if (winner == "Player1") {
                if (player_id == 1) {
                    window.open(win_redirect, '_blank');
                }
                if (player_id == 2){
                    window.open(lose_redirect, '_blank');
                }
            }
            if (winner == "Player2") {
                if (player_id == 1){
                    window.open(lose_redirect, '_blank');
                }
                if(player_id == 2){
                    window.open(win_redirect, '_blank');
                }
            }
            socket.emit("leave", {
                username: user,
                room: room,
                sid: session
            });
        }
    }
}
// switch whose turn it is.
function turn(player) {
    if (player == 1){
        curr_player = 2;
        document.getElementById("game_info").innerHTML = "Player 2's Turn";
        //
    }
    else {
        curr_player = 1;
        document.getElementById("game_info").innerHTML = "Player 1's Turn";
    }
}
// see if there is a winner
function check_winner() {            // if p1 has max hits (all p2 sunk) p1 wins
    winner = 'null';
    if (p1boats[0] == 5 && p1boats[1] == 4 && p1boats[2] == 3 && p1boats[3] == 3 && p1boats[4] == 2) {
        winner = "Player2";
        document.getElementById("game_info").innerHTML = winner + " has Won!";
    }
    if (p2boats[0] == 5 && p2boats[1] == 4 && p2boats[2] == 3 && p2boats[3] == 3 && p2boats[4] == 2) {
        winner = "Player1";
        document.getElementById("game_info").innerHTML = winner + " has Won!";
    }
    return winner;
}
// update hit counter arrays
function update_table(player, type, index){
    if(player == 2){
        p1boats[index]++;
        if (p1boats[0] == 5){
            $("#p1c").removeClass('statusdiv').addClass('statusdiv2');
            document.getElementById("p1c").innerHTML = "SUNK";
        }
        if (p1boats[1] == 4) {
            $("#p1b").removeClass('statusdiv').addClass('statusdiv2').innerHTML = "SUNK";
            document.getElementById("p1b").innerHTML = "SUNK";
        }
        if (p1boats[2] == 3) {
            $("#p1s").removeClass('statusdiv').addClass('statusdiv2').innerHTML = "SUNK";
            document.getElementById("p1s").innerHTML = "SUNK";
        }
        if (p1boats[3] == 3) {
            $("#p1d").removeClass('statusdiv').addClass('statusdiv2').innerHTML = "SUNK";
            document.getElementById("p1d").innerHTML = "SUNK";
        }
        if (p1boats[4] == 2) {
            $("#p1p").removeClass('statusdiv').addClass('statusdiv2').innerHTML = "SUNK";
            document.getElementById("p1p").innerHTML = "SUNK";
        }
    }
    else{
        p2boats[index]++;
        if (p2boats[0] == 5){
            $("#p2c").removeClass('statusdiv').addClass('statusdiv2').innerHTML = "SUNK";
            document.getElementById("p2c").innerHTML = "SUNK";
        }
        if (p2boats[1] == 4){
            $("#p2b").removeClass('statusdiv').addClass('statusdiv2').innerHTML = "SUNK";
            document.getElementById("p2b").innerHTML = "SUNK";
        }
        if (p2boats[2] == 3){
            $("#p2s").removeClass('statusdiv').addClass('statusdiv2').innerHTML = "SUNK";
            document.getElementById("p2s").innerHTML = "SUNK";
        }
        if (p2boats[3] == 3){
            $("#p2d").removeClass('statusdiv').addClass('statusdiv2').innerHTML = "SUNK";
            document.getElementById("p2d").innerHTML = "SUNK";
        }
        if (p2boats[4] == 2){
            $("#p2p").removeClass('statusdiv').addClass('statusdiv2').innerHTML = "SUNK";
            document.getElementById("p2p").innerHTML = "SUNK";
        }
    }
}
// go to choose spots on load:)
socket.on('move', function(action) {
    x = action['x'];
    y = action['y'];
    player = action['curr_player'];
    if(action['type'] == 'set_ship') choose_spots(x,y,player);
    if(action['type'] == 'move') update(x,y,player);
});
socket.on('p2-join', function (action) {
    document.getElementById('waiting_dialogue').style.display = 'none';
    document.getElementById('join_chat').style.display = 'initial';
    document.getElementById('join_chat_dialogue').style.display = 'initial';
    document.getElementById("game_info").innerHTML = "Player 1: Choose 5 Sequential Locations for your Carrier";
});
// try to leave the page.. and a alert is thrown! user is removed. messages are cleared. everything is hidden.
$(window).bind('beforeunload', function (action) {
    action.preventDefault();
    var user = $("#userName").val();
    socket.emit("leave", {
        username: user,
        room: room,
        sid: session
    });
    document.getElementById('input').style.display = 'none';
    document.getElementById('theMessages').style.display = 'none';
    document.getElementById('theList').style.display = 'none';
    document.getElementById('boardfeildsetp1').style.display = 'none';
    document.getElementById('boardfeildsetp1moves').style.display = 'none';
    document.getElementById('boardfeildsetp2').style.display = 'none';
    document.getElementById('boardfeildsetp2moves').style.display = 'none';
    document.getElementById('ship_status').style.display = 'none';
    document.getElementById('the_chat_app').style.display = 'none';

    return 'You have been kicked from the game for page change.';

});
