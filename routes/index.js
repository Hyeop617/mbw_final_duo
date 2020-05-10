const express = require("express");
const app = express();
const http = require('http');
const server = http.createServer(app);
const router = express.Router();
const fs = require('fs');
//라우터 객체 router는, get()함수를 이용해
//   /URL로 호출되었을 경우, 어떤 로직을 수행하도록 함 
const socket = require('socket.io');
const io = socket(server)
const User = require('../models/user');
const Matches = require('../models/matches');
const mongoose = require('mongoose');
const crypto = require("crypto");
const passport = require('passport');
const flash = require('connect-flash');
const LocalStrategy = require('passport-local').Strategy;
var nodemailer = require('nodemailer');
var path = require('path');
var smtpTramsporter = require('nodemailer-smtp-transport');

const request = require('request-promise'); // 크롤링 할때 쓰임.
const cheerio = require('cheerio'); // 크롤링 위한 cheerio 모듈
const session = require('express-session'); // 세션에 user.name과 user.email을 저장하기 위해 쓰임.
var teamnameApiSoccerstat = require("../teams"); // api와 크롤링한 데이터의 팀이름이 서로 다르므로, 매칭하기위해 쓰임.



passport.serializeUser(function (user, done) {
    console.log(user)
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    console.log('desrializeUser', user)
    done(null, user);
});

passport.use(new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    },
    function (req, email, password, done) {
        User.findOne({
            email: email,
            password: crypto.createHash('sha512').update(password).digest('base64')
        }, function (err, user) {
            if (err) {


                throw err;
            } else if (!user) {

                return done(null, false, req.flash('login_message', '이메일 또는 비밀번호를 확인하세요.'));

            } else {

                return done(null, user, req.flash('login_message', '로그인에 성공하셨습니다'));


            }
        });
    }
));

router.get('/chat', (req, res) => {
    fs.readFile('./public/chat.html', function (err, data) {
        if (err) {
            res.send('에러')
        } else {
            res.writeHead(200, {
                'Content-Type': 'text/html'
            })
            res.write(data)
            res.end()
        }
    })

});

io.sockets.on('connection', function (socket) {
    console.log('hd')
    socket.on('newUser', function (name) {
        console.log(name + ' 님이 접속하였습니다.')

        socket.name = name

        io.sockets.emit('update', {
            type: 'connect',
            name: 'SERVER',
            message: name + '님이 접속하였습니다.'
        })
    })

    socket.on('message', function (data) {
        data.name = socket.name

        console.log(data)

        socket.broadcast.emit('update', data);
    })

    socket.on('disconnect', function () {
        console.log(socket.name + ' 님이 나가셨습니다.')

        socket.broadcast.emit('update', {
            type: 'disconnect',
            name: 'SERVER',
            message: socket.name + '님이 나가셨습니다.'
        });
    })
});


router.post('/favorite', (req, res, next) => {
    var sess = req.session;
    var email = sess.passport != undefined ? sess.passport.user.email : "";

    if (email != "") {              // 로그인 했을 시  email 값이 "" 이 아니기 때문.

        Matches.find({
            "uid": req.body.uid,    // 경기 정보(uid)
            "email": email          // email(사용자 정보)
        }).exec().then(match => {
            if (match.length > 0) { // match.length >0 이란 것은 이미 있단 소리므로 delete문
                Matches.deleteOne({
                    uid: req.body.uid
                }).exec().then(result => {
                    console.log(result);
                    res.redirect('back');
                }).catch(err => {
                    console.log(err);
                })
            } else {                // match.length >0 !=0 이란 것은 없단 소리이므로 insert
                const match = new Matches({
                    _id: new mongoose.Types.ObjectId(),
                    email: email,
                    home: req.body.home,
                    away: req.body.away,
                    date: req.body.date,
                    oddwin: req.body.oddwin,
                    odddraw: req.body.odddraw,
                    oddlose: req.body.oddlose,
                    uid: req.body.uid,
                    league: req.body.league
                });
                match.save().then(result => {
                    console.log(result);
                    res.redirect('back');
                }).catch(err => {
                    console.log(err);
                })
            }
        })
    } else {
        res.send('<script type="text/javascript">alert("로그인이 필요합니다");window.history.back();</script>');
    }

})


router.get('/signin', (req, res) => {
    var sess = req.session;
    res.render('signin', {
        message: req.flash('login_message')
    })

});


router.post('/signin', passport.authenticate('local', {
        failureRedirect: '/signin',
        failureFlash: true
    }),
    function (req, res) {
        var sess = req.session;
        res.redirect('/signed_in');
    });


router.get('/signed_in', (req, res) => {

    var sess = req.session;
    res.render('signed_in', {
        message: req.flash('login_message')
    })


});


router.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/signin');
    res.send('로그아웃 되었습니다.');
});

router.post("/signup", (req, res, next) => {

    console.log(req.body);
    User.find({
            email: req.body.email // post에서 받은 이메일과 똑같은 이메일을 찾음(true면 중복이란 뜻.)
        })
        .exec()
        .then(user => {
            if (user.length >= 1) {
                res.send('<script type="text/javascript">alert("이미 존재하는 이메일입니다.");window.location="/signup";</script>'); // 중복 체크
            } else {
                const user = new User({
                    _id: new mongoose.Types.ObjectId(),
                    name: req.body.name,
                    email: req.body.email,
                    password: crypto.createHash('sha512').update(req.body.password).digest('base64')
                }); // 새로운 계정 생성
                user.save().then(result => {
                        console.log(result);
                        res.redirect("/signin");
                    })
                    .catch(err => {
                        console.log(err);
                    });

            }
        });
});

router.get('/myfavorite', (req, res, next) => {
    var sess = req.session;
    var username = sess.passport != undefined ? sess.passport.user.name : "";
    var email = sess.passport != undefined ? sess.passport.user.email : "";
    var matches = [];

    if (email != "") {
        Matches.find({
            email: email
        }).exec().then(match => {
            console.log(match);
            match.forEach((e, i) => {
                e.odd = [{
                    odd: e.oddwin
                }, {
                    odd: e.odddraw
                }, {
                    odd: e.oddlose
                }];
            })
            res.render("league", {
                username: username,
                data: match
            })
        }).catch(err => {
            console.log(err);
        })

    } else {
        res.send('<script type="text/javascript">alert("로그인이 필요합니다");window.history.back();</script>');
    }
})

var matchstat = {};
var leagueFixtures = [];
var leagueOdds = [];

router.get('/epl',
    function (req, res, next) {
        var options = {
            uri: 'https://www.soccerstats.com/leaguepreviews.asp?league=england&pmtype=homeaway',
            transform: function (body) {
                return cheerio.load(body);
            },
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Whale/2.6.88.13 Safari/537.36"
                // 이 사이트는 유저에이전트가 없어도 크롤링이 가능했지만, 혹시나 몰라서 유저 에이전트를 선언하였습니다. 
            }
        };
        request(options).then(($) => {
            var matches = []; // 경기정보(홈,어웨이,날짜, uid 등)을 담는 배열입니다.

            var list = $('#content > table > tbody > tr > td:nth-child(1) > table > tbody > tr > td > table:nth-child(3) > tbody > .trow2');

            for (var i = 0; i < list.length; i++) {
                home = list.eq(i).find('td:nth-child(4)').text();
                date = list.eq(i).find('td:nth-child(1) > b').text();
                uid = list.eq(i).find('#StatsBarBtn > a').attr("href");
                away = list.eq(++i).find('td:nth-child(2)').text();
                homeApi = ""; // Api상의 팀 이름

                uid.substr(uid.indexOf("stats=") + 6)

                // API와 SoccerStat에서 받아오는 팀명이 다르므로 API상의 팀 명을 따로 지정해주는 작업.
                teamnameApiSoccerstat.epl.forEach((e) => {
                    if (home == e[0])
                        homeApi = e[1]
                });

                matches.push({
                    league: "england",
                    home: home.split('\n')[1],
                    away: away.split('\n')[1],
                    uid: uid.substr(uid.indexOf("stats=") + 6),
                    date: date.split('\n')[1],
                    homeApi: homeApi
                });
            }
            req.matches = matches; // 세션에 matches를 담았습니다.(다음 미들웨어에서 쓰기 위해)
            next();

        }).catch((err) => {
            console.log(err);
        })

    },
    function (req, res, next) {
        var options = {
            method: 'GET',
            // 여기  url은 리그의 경기정보들이 들어있습니다.
            url: 'https://api-football-v1.p.rapidapi.com/v2/fixtures/league/524',
            qs: {
                timezone: 'Europe/London'
            },
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            },
            json: true
        };
        request(options).then((apiData) => {
            req.fixtures = apiData.api.fixtures; // 리그의 예정 경기들 받아와서 req에 담아서 넘김.
            next();
        }).catch((err) => {
            console.log(err);
        })
    },
    function (req, res, next) {
        var sess = req.session;
        // 세션의 passport.user가 없다면 "", 있다면 passport.user.name로 함.
        var username = sess.passport != undefined ? sess.passport.user.name : "";
        var options = {
            method: 'GET',
            // 여기 url은 해당리그의 배당이 들어있습니다.
            url: 'https://api-football-v1.p.rapidapi.com/v2/odds/league/524',
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            }
        };
        var matches = req.matches;
        request(options).then((apiData) => {
            var json = JSON.parse(apiData); // json 객체로 파싱
            leagueOdds = json.api.odds;

            leagueOdds.forEach((ele, ind) => {
                var oddFixId = ele.fixture.fixture_id; // odd가 들어 있는 json객체의 경기 번호
                req.fixtures.forEach((e, i) => {
                    if (e.fixture_id == ele.fixture.fixture_id) { // 경기 번호 서로 같을시에,
                        teamname = e.homeTeam.team_name; // 팀 네임을 teamname에 저장 후
                        matches.forEach((element, index) => { // 크롤링에서 긁은 배열을 for문 돌려
                            if (element.homeApi == teamname) { // 크롤링배열의 팀 네임과 일치하면
                                element.odd = ele.bookmakers[0].bets[0].values; // 배당 배열을 크롤링 배열에 넣음.                   
                            }
                        })
                    }
                })
            })
            res.render("league", {
                username: username, // username 혹은 ""
                data: matches
            });
        }).catch((err) => {
            console.log(err);
        })
    }
);
router.get('/laliga',
    function (req, res, next) {
        var options = {
            uri: 'https://www.soccerstats.com/leaguepreviews.asp?league=spain&pmtype=homeaway',
            transform: function (body) {
                return cheerio.load(body);
            },
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Whale/2.6.88.13 Safari/537.36"
            }
        };
        request(options).then(($) => {
            var matches = [];
            var list = $('#content > table > tbody > tr > td:nth-child(1) > table > tbody > tr > td > table:nth-child(3) > tbody > .trow2');

            for (var i = 0; i < list.length; i++) {
                home = list.eq(i).find('td:nth-child(4)').text();
                date = list.eq(i).find('td:nth-child(1) > b').text();
                uid = list.eq(i).find('#StatsBarBtn > a').attr("href");
                away = list.eq(++i).find('td:nth-child(2)').text();
                homeApi = "";

                uid.substr(uid.indexOf("stats=") + 6)

                // API와 SoccerStat에서 받아오는 팀명이 다르므로 API상의 팀 명을 따로 지정해주는 작업.
                teamnameApiSoccerstat.epl.forEach((e) => {
                    if (home == e[0])
                        homeApi = e[1]
                });

                matches.push({
                    league: "spain",
                    home: home.split('\n')[1],
                    away: away.split('\n')[1],
                    uid: uid.substr(uid.indexOf("stats=") + 6),
                    date: date.split('\n')[1],
                    homeApi: homeApi
                });
            }

            req.matches = matches;
            next();

        }).catch((err) => {
            console.log(err);
        })

    },

    function (req, res, next) {
        var options = {
            method: 'GET',
            url: 'https://api-football-v1.p.rapidapi.com/v2/fixtures/league/775',
            qs: {
                timezone: 'Europe/London'
            },
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            },
            json: true
        };
        var matches = req.matches;
        request(options).then((apiData) => {
            req.fixtures = apiData.api.fixtures; // 리그의 예정 경기들 받아와서 req에 담아서 넘김.
            next();
        }).catch((err) => {
            console.log(err);
        })
    },
    function (req, res, next) {
        var sess = req.session;
        var username = sess.passport != undefined ? sess.passport.user.name : "";
        var options = {
            method: 'GET',
            url: 'https://api-football-v1.p.rapidapi.com/v2/odds/league/775',
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            }
        };
        var matches = req.matches;
        request(options).then((apiData) => {
            var json = JSON.parse(apiData); // json 객체로 파싱
            leagueOdds = json.api.odds;

            leagueOdds.forEach((ele, ind) => {
                var oddFixId = ele.fixture.fixture_id; // odd가 들어 있는 json객체의 경기 번호
                req.fixtures.forEach((e, i) => {
                    if (e.fixture_id == ele.fixture.fixture_id) { // 경기 번호 서로 같을시에,
                        teamname = e.homeTeam.team_name; // 팀 네임을 teamname에 저장 후
                        matches.forEach((element, index) => { // 크롤링에서 긁은 배열을 for문 돌려
                            if (element.homeApi == teamname) { // 크롤링배열의 팀 네임과 일치하면
                                element.odd = ele.bookmakers[0].bets[0].values; // 배당 배열을 크롤링 배열에 넣음.                   
                            }
                        })
                    }
                })
            })
            res.render("league", {
                username: username,
                data: matches
            });
        }).catch((err) => {
            console.log(err);
        })
    }

);

router.get('/bundesliga',
    function (req, res, next) {
        var options = {
            uri: 'https://www.soccerstats.com/leaguepreviews.asp?league=germany&pmtype=homeaway',
            transform: function (body) {
                return cheerio.load(body);
            },
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Whale/2.6.88.13 Safari/537.36"
            }
        };
        request(options).then(($) => {
            var matches = [];
            var list = $('#content > table > tbody > tr > td:nth-child(1) > table > tbody > tr > td > table:nth-child(3) > tbody > .trow2');

            for (var i = 0; i < list.length; i++) {
                home = list.eq(i).find('td:nth-child(4)').text();
                date = list.eq(i).find('td:nth-child(1) > b').text();
                uid = list.eq(i).find('#StatsBarBtn > a').attr("href");
                away = list.eq(++i).find('td:nth-child(2)').text();
                homeApi = "";

                uid.substr(uid.indexOf("stats=") + 6)

                // API와 SoccerStat에서 받아오는 팀명이 다르므로 API상의 팀 명을 따로 지정해주는 작업.
                teamnameApiSoccerstat.epl.forEach((e) => {
                    if (home == e[0])
                        homeApi = e[1]
                });

                matches.push({
                    league: "germany",
                    home: home.split('\n')[1],
                    away: away.split('\n')[1],
                    uid: uid.substr(uid.indexOf("stats=") + 6),
                    date: date.split('\n')[1],
                    homeApi: homeApi
                });
            }

            req.matches = matches;
            next();

        }).catch((err) => {
            console.log(err);
        })

    },
    function (req, res, next) {
        var options = {
            method: 'GET',
            url: 'https://api-football-v1.p.rapidapi.com/v2/fixtures/league/754',
            qs: {
                timezone: 'Europe/London'
            },
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            },
            json: true
        };
        request(options).then((apiData) => {
            req.fixtures = apiData.api.fixtures; // 리그의 예정 경기들 받아와서 req에 담아서 넘김.
            next();
        }).catch((err) => {
            console.log(err);
        })
    },
    function (req, res, next) {
        var sess = req.session;
        var username = sess.passport != undefined ? sess.passport.user.name : "";
        var options = {
            method: 'GET',
            url: 'https://api-football-v1.p.rapidapi.com/v2/odds/league/754',
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            }
        };
        var matches = req.matches;
        request(options).then((apiData) => {
            var json = JSON.parse(apiData); // json 객체로 파싱
            leagueOdds = json.api.odds;

            leagueOdds.forEach((ele, ind) => {
                var oddFixId = ele.fixture.fixture_id; // odd가 들어 있는 json객체의 경기 번호
                req.fixtures.forEach((e, i) => {
                    if (e.fixture_id == ele.fixture.fixture_id) { // 경기 번호 서로 같을시에,
                        teamname = e.homeTeam.team_name; // 팀 네임을 teamname에 저장 후
                        matches.forEach((element, index) => { // 크롤링에서 긁은 배열을 for문 돌려
                            if (element.homeApi == teamname) { // 크롤링배열의 팀 네임과 일치하면
                                element.odd = ele.bookmakers[0].bets[0].values; // 배당 배열을 크롤링 배열에 넣음.                   
                            }
                        })
                    }
                })
            })
            res.render("league", {
                username: username,
                data: matches
            });
        }).catch((err) => {
            console.log(err);
        })
    }
);

router.get('/seriea',
    function (req, res, next) {
        var options = {
            uri: 'https://www.soccerstats.com/leaguepreviews.asp?league=italy&pmtype=homeaway',
            transform: function (body) {
                return cheerio.load(body);
            },
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Whale/2.6.88.13 Safari/537.36"
            }
        };
        request(options).then(($) => {
            var matches = [];
            var list = $('#content > table > tbody > tr > td:nth-child(1) > table > tbody > tr > td > table:nth-child(3) > tbody > .trow2');

            for (var i = 0; i < list.length; i++) {
                home = list.eq(i).find('td:nth-child(4)').text();
                date = list.eq(i).find('td:nth-child(1) > b').text();
                uid = list.eq(i).find('#StatsBarBtn > a').attr("href");
                away = list.eq(++i).find('td:nth-child(2)').text();
                homeApi = "";

                uid.substr(uid.indexOf("stats=") + 6)

                // API와 SoccerStat에서 받아오는 팀명이 다르므로 API상의 팀 명을 따로 지정해주는 작업.
                teamnameApiSoccerstat.epl.forEach((e) => {
                    if (home == e[0])
                        homeApi = e[1]
                });

                matches.push({
                    league: "italy",
                    home: home.split('\n')[1],
                    away: away.split('\n')[1],
                    uid: uid.substr(uid.indexOf("stats=") + 6),
                    date: date.split('\n')[1],
                    homeApi: homeApi
                });
            }

            req.matches = matches;
            next();

        }).catch((err) => {
            console.log(err);
        })

    },
    function (req, res, next) {
        var options = {
            method: 'GET',
            url: 'https://api-football-v1.p.rapidapi.com/v2/fixtures/league/891',
            qs: {
                timezone: 'Europe/London'
            },
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            },
            json: true
        };
        request(options).then((apiData) => {
            req.fixtures = apiData.api.fixtures; // 리그의 예정 경기들 받아와서 req에 담아서 넘김.
            next();
        }).catch((err) => {
            console.log(err);
        })
    },
    function (req, res, next) {
        var sess = req.session;
        var username = sess.passport != undefined ? sess.passport.user.name : "";
        var options = {
            method: 'GET',
            url: 'https://api-football-v1.p.rapidapi.com/v2/odds/league/891',
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            }
        };
        var matches = req.matches;
        request(options).then((apiData) => {
            var json = JSON.parse(apiData); // json 객체로 파싱
            leagueOdds = json.api.odds;

            leagueOdds.forEach((ele, ind) => {
                var oddFixId = ele.fixture.fixture_id; // odd가 들어 있는 json객체의 경기 번호
                req.fixtures.forEach((e, i) => {
                    if (e.fixture_id == ele.fixture.fixture_id) { // 경기 번호 서로 같을시에,
                        teamname = e.homeTeam.team_name; // 팀 네임을 teamname에 저장 후
                        matches.forEach((element, index) => { // 크롤링에서 긁은 배열을 for문 돌려
                            if (element.homeApi == teamname) { // 크롤링배열의 팀 네임과 일치하면
                                element.odd = ele.bookmakers[0].bets[0].values; // 배당 배열을 크롤링 배열에 넣음.                   
                            }
                        })
                    }
                })
            })
            res.render("league", {
                username: username,
                data: matches
            });
        }).catch((err) => {
            console.log(err);
        })
    }
);
router.get('/ligue1',
    function (req, res, next) {
        var options = {
            uri: 'https://www.soccerstats.com/leaguepreviews.asp?league=france&pmtype=homeaway',
            transform: function (body) {
                return cheerio.load(body);
            },
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Whale/2.6.88.13 Safari/537.36"
            }
        };
        var sess = req.session;
        request(options).then(($) => {
            var matches = [];
            var list = $('#content > table > tbody > tr > td:nth-child(1) > table > tbody > tr > td > table:nth-child(3) > tbody > .trow2');

            for (var i = 0; i < list.length; i++) {
                home = list.eq(i).find('td:nth-child(4)').text();
                date = list.eq(i).find('td:nth-child(1) > b').text();
                uid = list.eq(i).find('#StatsBarBtn > a').attr("href");
                away = list.eq(++i).find('td:nth-child(2)').text();
                homeApi = "";

                uid.substr(uid.indexOf("stats=") + 6)

                // API와 SoccerStat에서 받아오는 팀명이 다르므로 API상의 팀 명을 따로 지정해주는 작업.
                teamnameApiSoccerstat.epl.forEach((e) => {
                    if (home == e[0])
                        homeApi = e[1]
                });

                matches.push({
                    league: "france",
                    home: home.split('\n')[1],
                    away: away.split('\n')[1],
                    uid: uid.substr(uid.indexOf("stats=") + 6),
                    date: date.split('\n')[1],
                    homeApi: homeApi
                });
            }

            req.matches = matches;
            next();

        }).catch((err) => {
            console.log(err);
        })

    },
    function (req, res, next) {
        var options = {
            method: 'GET',
            url: 'https://api-football-v1.p.rapidapi.com/v2/fixtures/league/525',
            qs: {
                timezone: 'Europe/London'
            },
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            },
            json: true
        };
        request(options).then((apiData) => {
            req.fixtures = apiData.api.fixtures; // 리그의 예정 경기들 받아와서 req에 담아서 넘김.
            next();
        }).catch((err) => {
            console.log(err);
        })
    },
    function (req, res, next) {
        var sess = req.session;
        var username = sess.passport != undefined ? sess.passport.user.name : "";
        var options = {
            method: 'GET',
            url: 'https://api-football-v1.p.rapidapi.com/v2/odds/league/525',
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            }
        };
        var matches = req.matches;
        request(options).then((apiData) => {
            var json = JSON.parse(apiData); // json 객체로 파싱
            leagueOdds = json.api.odds;

            leagueOdds.forEach((ele, ind) => {
                var oddFixId = ele.fixture.fixture_id; // odd가 들어 있는 json객체의 경기 번호
                req.fixtures.forEach((e, i) => {
                    if (e.fixture_id == ele.fixture.fixture_id) { // 경기 번호 서로 같을시에,
                        teamname = e.homeTeam.team_name; // 팀 네임을 teamname에 저장 후
                        matches.forEach((element, index) => { // 크롤링에서 긁은 배열을 for문 돌려
                            if (element.homeApi == teamname) { // 크롤링배열의 팀 네임과 일치하면
                                element.odd = ele.bookmakers[0].bets[0].values; // 배당 배열을 크롤링 배열에 넣음.                   
                            }
                        })
                    }
                })
            })
            res.render("league", {
                username: username,
                data: matches
            });
        }).catch((err) => {
            console.log(err);
        })
    }
);
router.get('/eredivisie',
    function (req, res, next) {
        var sess = req.session;
        var options = {
            uri: 'https://www.soccerstats.com/leaguepreviews.asp?league=netherlands&pmtype=homeaway',
            transform: function (body) {
                return cheerio.load(body);
            },
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Whale/2.6.88.13 Safari/537.36"
            }
        };
        request(options).then(($) => {
            var matches = [];
            var list = $('#content > table > tbody > tr > td:nth-child(1) > table > tbody > tr > td > table:nth-child(3) > tbody > .trow2');

            for (var i = 0; i < list.length; i++) {
                home = list.eq(i).find('td:nth-child(4)').text();
                date = list.eq(i).find('td:nth-child(1) > b').text();
                uid = list.eq(i).find('#StatsBarBtn > a').attr("href");
                away = list.eq(++i).find('td:nth-child(2)').text();
                homeApi = "";

                uid.substr(uid.indexOf("stats=") + 6)

                // API와 SoccerStat에서 받아오는 팀명이 다르므로 API상의 팀 명을 따로 지정해주는 작업.
                teamnameApiSoccerstat.epl.forEach((e) => {
                    if (home == e[0])
                        homeApi = e[1]
                });

                matches.push({
                    league: "netherlands",
                    home: home.split('\n')[1],
                    away: away.split('\n')[1],
                    uid: uid.substr(uid.indexOf("stats=") + 6),
                    date: date.split('\n')[1],
                    homeApi: homeApi
                });
            }

            req.matches = matches;
            next();

        }).catch((err) => {
            console.log(err);
        })

    },
    function (req, res, next) {
        var options = {
            method: 'GET',
            url: 'https://api-football-v1.p.rapidapi.com/v2/fixtures/league/566',
            qs: {
                timezone: 'Europe/London'
            },
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            },
            json: true
        };
        request(options).then((apiData) => {
            req.fixtures = apiData.api.fixtures; // 리그의 예정 경기들 받아와서 req에 담아서 넘김.
            next();
        }).catch((err) => {
            console.log(err);
        })
    },
    function (req, res, next) {
        var sess = req.session;
        var username = sess.passport != undefined ? sess.passport.user.name : "";
        var options = {
            method: 'GET',
            url: 'https://api-football-v1.p.rapidapi.com/v2/odds/league/566',
            headers: {
                'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
                'x-rapidapi-key': '09d0c1e96bmsh595738f70db3abcp157e3ajsn2711a1979a04'
            }
        };
        var matches = req.matches;
        request(options).then((apiData) => {
            var json = JSON.parse(apiData); // json 객체로 파싱
            leagueOdds = json.api.odds;

            leagueOdds.forEach((ele, ind) => {
                var oddFixId = ele.fixture.fixture_id; // odd가 들어 있는 json객체의 경기 번호
                req.fixtures.forEach((e, i) => {
                    if (e.fixture_id == ele.fixture.fixture_id) { // 경기 번호 서로 같을시에,
                        teamname = e.homeTeam.team_name; // 팀 네임을 teamname에 저장 후
                        matches.forEach((element, index) => { // 크롤링에서 긁은 배열을 for문 돌려
                            if (element.homeApi == teamname) { // 크롤링배열의 팀 네임과 일치하면
                                element.odd = ele.bookmakers[0].bets[0].values; // 배당 배열을 크롤링 배열에 넣음.                   
                            }
                        })
                    }
                })
            })
            res.render("league", {
                username: username,
                data: matches
            });
        }).catch((err) => {
            console.log(err);
        })
    }
);

router.use('/matchstat', function (req, res, next) {
        var uid = req.query.uid;
        var league = req.query.league;

        var options = {
            uri: 'https://www.soccerstats.com/pmatch.asp?league=' + league + '&stats=' + uid,
            transform: function (body) {
                return cheerio.load(body);
            },
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Whale/2.6.88.13 Safari/537.36"
            }
        };
        request(options).then(($) => {
            matchstat = {};
            matchstat.home = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(3) > tbody > tr.trow2 > td:nth-child(1) > h2').text();
            matchstat.away = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(3) > tbody > tr.trow2 > td:nth-child(3) > h2').text();
            matchstat.homeHomeGP = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(2) > font').text();
            matchstat.homeHomeWin = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(3) > font > b').text();
            matchstat.homeHomeDraw = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(4) > font > b').text();
            matchstat.homeHomeLose = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(5) > font > b').text();
            matchstat.awayAwayGP = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(7) > font').text();
            matchstat.awayAwayWin = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(8) > font > b').text();
            matchstat.awayAwayDraw = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(9) > font > b').text();
            matchstat.awayAwayLose = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(10) > font > b').text();
            matchstat.homeTotalGP = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(2)').text();
            matchstat.homeTotalWin = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(3)').text();
            matchstat.homeTotalDraw = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(4)').text();
            matchstat.homeTotalLose = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(5)').text();
            matchstat.awayTotalGP = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(7)').text();
            matchstat.awayTotalWin = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(8)').text();
            matchstat.awayTotalDraw = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(9)').text();
            matchstat.awayTotalLose = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(10)').text();
            var homeTable = [];
            var awayTable = [];
            var hometablelist = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(10) > tbody > tr > td:nth-child(1) > table > tbody > tr:nth-child(2) > td > table > tbody > tr');
            var awaytablelist = $('#content > div:nth-child(6) > div > div.five.columns > table:nth-child(10) > tbody > tr > td:nth-child(3) > table > tbody > tr:nth-child(2) > td > table > tbody > tr');

            for (var i = 1; i < hometablelist.length; i++) {
                var hometableElement = {};
                hometableElement.teamname = hometablelist.eq(i).find('td:nth-child(2)').text().split('\n')[1];
                hometableElement.gameplayed = hometablelist.eq(i).find('td:nth-child(3) > font').text();
                hometableElement.point = hometablelist.eq(i).find('td:nth-child(4) > b').text();
                var awaytableElement = {};
                awaytableElement.teamname = awaytablelist.eq(i).find('td:nth-child(2)').text().split('\n')[1];
                awaytableElement.gameplayed = awaytablelist.eq(i).find('td:nth-child(3) > font').text();
                awaytableElement.point = awaytablelist.eq(i).find('td:nth-child(4) > b').text();

                homeTable.push(hometableElement);
                awayTable.push(awaytableElement);
            }
            matchstat.homeTable = homeTable;
            matchstat.awayTable = awayTable;


            var h2hMatch = [];
            var h2hMatchlist = $('#content > div:nth-child(6) > div > div.seven.columns > table:nth-child(41) > tbody > tr:nth-child(3) > td > table > tbody > tr');
            for (var i = 0; i < h2hMatchlist.length; i++) {
                var h2hMatchElement = {};
                h2hMatchElement.date = h2hMatchlist.eq(i).find('td:nth-child(1) > font').text();
                h2hMatchElement.home = h2hMatchlist.eq(i).find('td:nth-child(2)').text().split(' - ')[0];
                h2hMatchElement.away = h2hMatchlist.eq(i).find('td:nth-child(2)').text().split(' - ')[1];
                h2hMatchElement.score = h2hMatchlist.eq(i).find('td:nth-child(3) > b').text();

                h2hMatch.push(h2hMatchElement);
            }
            matchstat.h2hMatch = h2hMatch;

            var h2h = {
                win: $('#content > div:nth-child(6) > div > div.seven.columns > table:nth-child(41) > tbody > tr:nth-child(4) > td > table > tbody > tr:nth-child(1) > td:nth-child(2) > font > b').text(),
                draw: $('#content > div:nth-child(6) > div > div.seven.columns > table:nth-child(41) > tbody > tr:nth-child(4) > td > table > tbody > tr:nth-child(2) > td:nth-child(2) > font > b').text(),
                lose: $('#content > div:nth-child(6) > div > div.seven.columns > table:nth-child(41) > tbody > tr:nth-child(4) > td > table > tbody > tr:nth-child(3) > td:nth-child(2) > font > b').text()
            }
            matchstat.h2h = h2h;

            var leagueTable = [];
            var last8Table = [];
            var leaguetablelist = $('#container > div.row > table:nth-child(1) > tbody > tr:nth-child(1) > td > table:nth-child(2) > tbody > tr > td:nth-child(1) > table > tbody > tr');
            var last8tablelist = $('#container > div.row > table:nth-child(1) > tbody > tr:nth-child(1) > td > table:nth-child(2) > tbody > tr > td:nth-child(2) > table > tbody > tr');
            for (var i = 2; i < leaguetablelist.length; i++) {
                var leaguetableElement = {};
                leaguetableElement.teamname = leaguetablelist.eq(i).find('td:nth-child(2)').text();
                leaguetableElement.gameplayed = leaguetablelist.eq(i).find('td:nth-child(3) > font').text();
                leaguetableElement.point = leaguetablelist.eq(i).find('td:nth-child(4) > b').text();
                var last8tableElement = {};
                last8tableElement.teamname = last8tablelist.eq(i).find('td:nth-child(2)').text();
                last8tableElement.gameplayed = last8tablelist.eq(i).find('td:nth-child(3) > font').text();
                last8tableElement.point = last8tablelist.eq(i).find('td:nth-child(4) > b').text();

                leagueTable.push(leaguetableElement);
                last8Table.push(last8tableElement);
            }
            matchstat.leagueTable = leagueTable;
            matchstat.last8Table = last8Table;

            var recentTable = [];
            var recentlist = $('#content > div:nth-child(6) > div.row > div.seven.columns > table:nth-child(2) > tbody > tr');
            for (var i = 0; i < recentlist.length - 1; i++) {
                var recentElement = {};
                recentElement.homescore = recentlist.eq(i).find('td:nth-child(3) > font > b').text();
                recentElement.awayscore = recentlist.eq(i).find('td:nth-child(5) > font > b').text();
                recentTable.push(recentElement);
            }

            req.recentTable = recentTable;
            req.othermatchesLink = $('#content > div:nth-child(6) > div.row > div.seven.columns > table:nth-child(3) > tbody > tr > td > span > a').attr('href');


            next();

        }).catch((err) => {
            console.log(err);
        })
    },
    function (req, res, next) {
        // 최근 경기를 받아오기위해 다른 페이지를 크롤링 했습니다.
        var sess = req.session;
        var username = sess.passport !=  undefined ? sess.passport.user.name : "";
        var options = {
            uri: 'https://www.soccerstats.com/' + req.othermatchesLink,
            transform: function (body) {
                return cheerio.load(body);
            },
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Whale/2.6.88.13 Safari/537.36"
            }
        };
        request(options).then(($) => {



            var homeRecentTable = [];
            var homeRecentlist = $('#content > div:nth-child(7) > div:nth-child(1) > table:nth-child(6) > tbody > tr');
            for (var i = homeRecentlist.length, count = 0; count < 8; i--) {
                if (homeRecentlist.eq(i).attr('bgcolor') == '#FFFFBF' || homeRecentlist.eq(i).attr('bgcolor') == '#FFCACA' || homeRecentlist.eq(i).attr('bgcolor') == '#D7EFBE') {

                    var homeRecentElement = {};
                    homeRecentElement.date = homeRecentlist.eq(i).find('td:nth-child(1) > font').text().split('\n')[1];
                    homeRecentElement.home = homeRecentlist.eq(i).find('td:nth-child(2) > b').text() == "" ?
                        homeRecentlist.eq(i).find('td:nth-child(2)').text().split('\n')[1] :
                        homeRecentlist.eq(i).find('td:nth-child(2) > b').text().split('\n')[1];
                    homeRecentElement.away = homeRecentlist.eq(i).find('td:nth-child(4) > b').text() == "" ?
                        homeRecentlist.eq(i).find('td:nth-child(4)').text().split('\n')[1] :
                        homeRecentlist.eq(i).find('td:nth-child(4) > b').text().split('\n')[1];

                    homeRecentTable.push(homeRecentElement);
                    count++;
                }
            }
            var awayRecentTable = [];
            var awayRecentlist = $('#content > div:nth-child(7) > div:nth-child(2) > table:nth-child(6) > tbody > tr');
            for (var i = awayRecentlist.length, count = 0; count < 8; i--) {
                if (awayRecentlist.eq(i).attr('bgcolor') == '#FFFFBF' || awayRecentlist.eq(i).attr('bgcolor') == '#FFCACA' || awayRecentlist.eq(i).attr('bgcolor') == '#D7EFBE') {

                    var awayRecentElement = {};
                    awayRecentElement.date = awayRecentlist.eq(i).find('td:nth-child(1) > font').text().split('\n')[1];
                    awayRecentElement.home = awayRecentlist.eq(i).find('td:nth-child(2) > b').text() == "" ?
                        awayRecentlist.eq(i).find('td:nth-child(2)').text().split('\n')[1] :
                        awayRecentlist.eq(i).find('td:nth-child(2) > b').text().split('\n')[1];
                    awayRecentElement.away = awayRecentlist.eq(i).find('td:nth-child(4) > b').text() == "" ?
                        awayRecentlist.eq(i).find('td:nth-child(4)').text().split('\n')[1] :
                        awayRecentlist.eq(i).find('td:nth-child(4) > b').text().split('\n')[1];

                    awayRecentTable.push(awayRecentElement);
                    count++;
                }
            }
            req.recentTable.forEach((e, i) => {
                homeRecentTable[i].score = e.homescore;
                awayRecentTable[i].score = e.awayscore;
            })
            matchstat.homeRecentTable = homeRecentTable;
            matchstat.awayRecentTable = awayRecentTable;



            res.render("matchstat", {
                username: username,
                matchstat: matchstat
            });

        }).catch((err) => {
            console.log(err);
        })
    }
);





router.get('/', (req, res) => {
    var sess = req.session;
    console.log(sess.passport == undefined);
    console.log("패스포트입니다.");
    console.log(sess.passport);
    var username = sess.passport != undefined ? sess.passport.user.name : "";
    console.log(username);
    var email = sess.passport != undefined ? sess.passport.user.email : "";
    res.render("index", {
        username: username,
        email: email
    })
});
router.get('/signed_in', (req, res) => res.render('signed_in', {
    page: 'signed_in'
}));

router.get("/signup", (req, res) => {
    res.render("signup", {
        page: "signup"
    })
});


module.exports = router;
