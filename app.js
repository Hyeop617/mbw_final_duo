const express = require('express'); //express 모듈 추출 
const app = express(); //app변수에다가 express모듈을 적재 
const http = require('http')
const server = http.createServer(app)
const socket = require('socket.io')
const io = socket(server)

const PORT = process.env.PORT || 3000; // PORT변수에다가 3000번 포트를 적재 



const route = require("./routes/index");
//const signinRoute = require("./routes/signin");
//const eplRoute = require("./routes/epl");

const mongoose = require('mongoose'); //몽고DB를 쉽게 사용할 수 있게 도와주는 모듈

const bodyParser = require("body-parser"); //접속한 클라이언트의 쿠키정보에 접근하기 위한 모듈 

const passport = require('passport');

const LocalStrategy = require('passport-local').Strategy;

const Session = require('express-session');
//const Session1 = require('cookie-parse');

const flash = require('connect-flash');
var MongoDBStore = require('connect-mongodb-session')(Session);

let url = "mongodb://localhost:27017/dalhav";

mongoose.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
});


app.use(bodyParser.urlencoded({
    extended: true
}));

app.set('views', __dirname + '/views'); //템플릿 파일의 위치 정의
app.set('view engine', 'ejs'); //템플릿 엔진 종류 정의
//app.set으로, 템플릿 엔진의 종류와 템플릿 파일의 위치를 정의.
//app.use('/css', express.static('./public/css'))
//app.use('/js', express.static('./public/js'))

app.use(express.static(__dirname + "/public"));



var store = new MongoDBStore({
    uri: url,
    collection: 'sessions'
});

store.on('error', function (error) {
    console.log(error);
});

app.use(Session({
    secret: 'dalhav',
    resave: false,
    saveUninitialized: true,
    rolling: true,
    cookie: {
        maxAge: 1000 * 60 * 60
    },
    store: store
}));
app.use(passport.initialize());
app.use(passport.session());

//app.use(express.static(__dirname + '/public'));
//express.static으로 public 폴더에 static파일의 위치 지정

app.use(flash());

app.use("/", route); //라우팅 설정
app.use("/signin", route)
app.use("/league", route)
app.use("/matchstat/:uid", route)
app.use("/favorite/:uid", route)
app.use("/myfavorite", route)

server.listen(PORT || function () {
    console.log('Example app listening on port', PORT);
});
