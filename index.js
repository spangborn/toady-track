/**
 * Creates a new Test mod
 *
 * @param {Object} config Contains config fields specific to this mod
 * @param {Object} client The connected IRC client powering the bot
 * @param {Object} modMan A reference to the ModManager object,
 * responsible for loading/unloading mods and commands.
 * @returns {Object} The new Test mod
 */
module.exports = function(config, client, modMan) {
	const sqlite3 = require('sqlite3').verbose();

	db = new sqlite3.Database('mods/track/db/track.db', (err) => {
	    if (err) {
	        return console.error(err.message);
	    }
	    console.log("Connected to track database.");
	});

	let sql = `CREATE TABLE if not exists track (track_id INTEGER PRIMARY KEY, nickname TEXT NOT NULL, hostname TEXT NOT NULL, seen TEXT NOT NULL, UNIQUE(nickname, hostname) );`
	db.run(sql, (err) => {
    	if (err) {
	        return console.log(err.message);
	    }
    	console.log("Created database if it didn't exist");
	});

	function getNicksForHost(hostname, callback) {
		console.log("Querying database for hostname: " + hostname);
		let sql = `SELECT *
					FROM track
					WHERE hostname = ?`;

		var nicks = [];

		db.each(sql, [hostname], (err,row) => {
			// Row Callback
			if (err) return console.error(err.message);
			nicks.push(row.nickname);
		}, (err,row) => {
			// Complete callback
			if (err) return console.error(err.message);
			if (typeof callback === "function") callback(nicks);
		});
	}

    function getHostsForNick(nickname, callback) {
		console.log("Querying database for nickname: " + nickname);

        let sql = `SELECT * FROM track
                    WHERE nickname = ?`;

        var hosts = [];

		db.each(sql, [nickname], (err,row) => {
			// Row Callback
			if (err) return console.error(err.message);
			hosts.push(row.hostname);
		}, (err,row) => {
			// Complete callback
			if (err) return console.error(err.message);
			if (typeof callback === "function") callback(hosts);
		});
    }

	function getAllData(callback) {
		console.log("Getting all the track data.");

		let sql = `SELECT * from track`;

		var data = [];

		db.each(sql, [], (err,row) => {
			// Row Callback
			if (err) return console.error(err.message);
			hosts.push(row);
		}, (err,rows) => {
			// Complete Callback
			if (err) return console.error(err.message);
			if (typeof callback === "function") callback(data);
		});
	}

	function getStats(callback) {
		let sql = `SELECT * from track`;

		var result = "Number of entries in the database: ";
		var total = 0;

		db.all(sql, [], (err,rows) => {
			if (err) return console.error(err.message);
			if (typeof callback === "function") callback (result + rows.length);
		});
	}

	function addNickHostToDatabase(nickname, hostname) {

		console.log("Aadding user to database: " + nickname + " (" + hostname + ")");

		let updatesql = `INSERT into track (nickname, hostname, seen)
                    VALUES ((?), (?), (?));
					COMMIT;`

		db.run(updatesql, [nickname, hostname, new Date()], function(err) {
		    if (err) return console.error(err.message);
			console.log("Added " + nickname + " (" + hostname + ") to database.");
		});

	}

	function nickHandler(oldnick, newnick, channels, message) {
		client.whois (newnick, function (info) {
			console.log("Whois returned: " + info.nick + "!" + info.user + "@" + info.host);
			addNickHostToDatabase(info.nick, info.host);
		});
	}
	function msgHandler() {}
	function joinHandler(channel, nick, raw) {
		addNickHostToDatabase(raw.nick, raw.host);
	}
	function kickHandler() {}

	// Attach events to listen for nick changes, joins/parts, messages
	client.on('nick', nickHandler);
	client.on('join', joinHandler);

    return {
        name: "track",
        version: "0.1.0",
        author: "spangborn",
        desc: "Logs user nicks and hostmasks",
        commands: {
           nicklist: {
                handler: function(from, to, target, args, inChan) {
					var param = args.length > 0 ? args[0] : "";
					getNicksForHost(param, function (hosts) {
						if (hosts.length > 0) {
          	              	client.say(from, "Nicks for " + param + ": " + hosts)
	                	}
             	    	else {
	                		client.say(from, "No nicks for " + param + " found.");
    		        	}
					});

                },
                desc: "Messages you with the nicks and hostmasks of a user",
                help: [
                    "Format: {cmd} <hostname>",
                    "Examples:",
                    " {!}{cmd} user/spangborn"
                ],
                targetChannel: false
            },
			hostlist: {
				handler: function(from, to, target, args, inChan) {
					var param = args.length > 0 ? args[0] : "";
					getHostsForNick(param, function (hosts) {
						if (hosts.length > 0) {
          	              	client.notice(from, "Hosts for " + param + ": " + hosts);
		                }
             	       	else {
	                        client.notice(from, "No hosts for " + args[0]  + " found.");
    		            }
					});

				},
				desc: "Messages you with the hosts of a user",
				help: [
					"Format: {cmd} <hostname>",
					"Examples:",
					" {!}{cmd} spangborn"
				],
				targetChannel: false
			},
            stats: {
                handler: function(from, to, target, args, inChan) {
					getStats(function (stats) {
						client.notice(from, stats);
					});
                },
                desc: "Messages you with the stats",
                help: [],
                targetChannel: false
            },
			trackdump: {
                handler: function(from, to, target, args, inChan) {
					getAllData(function (data) {
						client.notice("Sending all tracking data...");
						for (row in data) {
							client.notice(row.track_id + " | " + row.nickname + " | " + row.hostname);
						}
						client.notice("End of tracking data.");
					});
                },
                desc: "Messages you with the stats",
                help: [],
                targetChannel: false
            }
        },
		unload: function () {
			// unload
			client.removeListener('nick', nickHandler);
			client.removeListener('join', joinHandler);

			db.close((err) => {
				if (err) {
					console.error(err.message);
				}
				console.log("Closed the database connection.");
			});
		}
    };
};
