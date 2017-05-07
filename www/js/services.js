angular.module('starter.services', [])

//http 요청 함수
.service('httpFunction',function ($ionicLoading, $http, $q, $ionicHistory,$timeout$timeout) {
    var WEB_SERVER_URL = 'https://yourDomain.com/';

    //요청 재시도 함수
    function re_http(param,_url,isFront,try_cnt){
        var q = $q.defer();
        if(try_cnt === undefined){
            try_cnt = Number(0);
        }

        if(isFront){
            $ionicLoading.show({
                template: '<ion-spinner></ion-spinner><br>연결 중입니다..('+try_cnt+')'
            });
        }

        $timeout(function() {
            $http({
                method: "post",
                url:_url,
                data: param,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
                }
            }).success(function (data, status, headers, config) {
                console.log('scu'+status);
                if(isFront){
                    $ionicLoading.hide();
                }
                q.resolve(data);
            }).error(function (data, status, headers, config) {
                if(2 > try_cnt){
                    try_cnt++;
                    q = re_http(param,_url,isFront,try_cnt);
                } else {
                    if(isFront){
                        $ionicLoading.hide();
                    }
                    alert('연결 실패\n잠시후 다시 시도해주세요.');
                    $ionicHistory.goBack(-1);
                    q.reject(status);
                }
            });
        }, 5000);

        return q.promise;
    }

    this.http = function(param, _url){
        var url = WEB_SERVER_URL+_url;
        var q = $q.defer();

        $ionicLoading.show({
            template: '<ion-spinner></ion-spinner><br>불러오는중..'
        });

        $http({
            method: "post",
            url: url,
            data: param,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
            }
        }).success(function (data, status, headers, config) {
            $ionicLoading.hide();
            q.resolve(data);
        }).error(function (data, status, headers, config) {
            $ionicLoading.hide();
            q = re_http(param, url,true);
        });
        return q.promise;
    }
})
.service('chatFunction',function($q,$rootScope,httpFunction,$cordovaDialogs,$state,$ionicHistory){

    //채팅방 목록 가져오기
    this.selectChatRoomList = function () {
        var q = $q.defer();
        var url = 'selectChatRoomList.do';
        var param = '';
        httpFunction.http(param,url).then(function(data){
            q.resolve(data);
        });
        return q.promise;
    }

    //채팅방 연결 ---- id로 요청은 꼭 room_code가 배열이여함 !!!!
    this.goChat = function (room_code) {
        $ionicHistory.nextViewOptions({
            disableAnimate: false,
            disableBack: false
        });
        if(room_code === undefined){
            $cordovaDialogs.alert('죄송합니다. 친구목록 탭에서 이용해주세요.','알림','확인');
            return;
        }
        if(typeof room_code === 'string'){
            if(room_code == $rootScope.user_info.id || room_code == ''){
                $cordovaDialogs.alert('대화 상대가 잘못되었습니다.','알림','확인');
                return;
            }
            //id가 한명일 때 여기로 분기 처리 되는디 서버에서 처리 할려면 자신의id도 넣어야됨

        } else if(angular.isArray(room_code)){
            if(room_code.indexOf($rootScope.user_info.id) == -1){
                room_code.push($rootScope.user_info.id);
            }
            if(2 > room_code.length){
                $cordovaDialogs.alert('대화 상대가 잘못되었습니다.','알림','확인');
                return;
            }
        }
        if($ionicHistory.currentStateName() != 'chat'){
            console.log('현재 페이지가 chat 페이지 XXXX');
            $state.go('chat', {
                "room_code": room_code
            });
        } else {
            console.log('현재 페이지가 chat 페이지 !!');
        }
    }
})

.factory('socket', function ($rootScope,$timeout) {
    var chat_server = 'https://yourDomain.com:443';
    var socket = io.connect(chat_server, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax : 500,
        reconnectionAttempts: 10
    });

    return {
        on: function (eventName, callback) {
            socket.on(eventName, function () {
                var args = arguments;
                if($rootScope.$$phase != '$apply' && $rootScope.$$phase != '$digest' ) {
                    $rootScope.$apply(function () {
                        callback.apply(socket, args);
                    });
                }
            });
        },
        once: function (eventName, callback) {
            socket.once(eventName, function () {
                var args = arguments;
                if($rootScope.$$phase != '$apply' && $rootScope.$$phase != '$digest' ) {
                    $rootScope.$apply(function () {
                        callback.apply(socket, args);
                    });
                }
            });
        },
        connect: function () {
            socket.connect();
        },
        disconnect: function () {
            socket.disconnect();
        },
        reconnect: function () {
            socket.disconnect();
            $timeout(function(){
                socket.connect();
            },500);
        },
        removeListener : function(){
            socket.removeListener();
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                if($rootScope.$$phase != '$apply' && $rootScope.$$phase != '$digest' ) {
                    $rootScope.$apply(function () {
                        callback.apply(socket, args);
                    });
                }
            })
        }
    };
})
;