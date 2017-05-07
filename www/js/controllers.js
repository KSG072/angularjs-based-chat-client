angular.module('starter.controllers', [])

.controller('DashCtrl', function($scope) {})

.controller('ChatsCtrl', function($scope, $rootScope, chatFunction) {
    //채팅방 목록
    $scope.chatRoomList = new Array; //채팅방 목록 배열

    //채팅방 목록 가져오기
    chatFunction.selectChatRoomList().then(function(data){
        data.chatRoomList.forEach(function (item) {
            $scope.chatRoomList.push({
                room_name: item.room_name,
                room_code: item.room_code,
                last_time: item.last_time,
                un_read_count : item.un_read_count,
                last_message : item.last_message,
                is_group : item.member_list.length > 2 ? true : false
            });
        });
    });

    //채팅방 이동
    $scope.goChat = function (room_code) {
        chatFunction.goChat(room_code);
    }

})

.controller('ChatDetailCtrl', function($scope, $stateParams,$rootScope, socket,$cordovaDialogs,$timeout) {
    socket.removeListener();
    socket.connect();

    //채팅방 정보
    $scope.chat_room_info = {
        room_code : '',
        member_list : [],
        message_list : [],
        room_name : ''
    };

    //채팅방 접속 소켓 요청
    function joinChatRoom(new_room_code) {
        var is_connection = false;
        var target_room_code = '';
        new_room_code ? target_room_code = new_room_code : target_room_code = $stateParams.room_code;
        console.log('new_room_code',new_room_code);
        var loading_title = '';
        is_reconnect ? loading_title = '문제가 발생하여 재접속 중입니다.' : loading_title = '불러오는중..';
        $ionicLoading.show({
            template: '<ion-spinner></ion-spinner><br>'+loading_title
        });
        socket.emit('join',{
            me : $rootScope.user_info.id,
            room_code : target_room_code
        },function (res) {
            is_connection = true;
            console.log('join',JSON.stringify(res));
            if(res.room_code){
                setMessageList(res)
            } else {
                $cordovaDialogs.alert('잘못된 채팅방입니다.', "SchoolWare", "확인");
                $scope.disconnect();
            }
            $ionicLoading.hide();
        });
        $timeout(function(){
            if(is_connection == false){
                $ionicLoading.hide();
                $cordovaDialogs.alert('잠시후 다시 시도해주세요.', "SchoolWare", "확인").then(function () {
                    $scope.disconnect();
                });
            }
        }, 8000);
    }

    joinChatRoom();

    //메시지 리스트 세팅
    function setMessageList(data) {

        $scope.chat_room_info.room_code = data.room_code; //채팅방 코드
        $scope.chat_room_info.member_list = data.member_list; //채팅방 맴버

        //안 읽은 메시지 개수
        if(angular.isNumber(data.read_meg_list)){

            $rootScope.tab_meg_cnt.chat -= data.read_meg_list;

            if(!angular.isNumber($rootScope.tab_meg_cnt.chat) || $rootScope.tab_meg_cnt.chat < 0){
                $rootScope.tab_meg_cnt.chat = 0;
            }

            var badge = $rootScope.tab_meg_cnt.etc+$rootScope.tab_meg_cnt.room+$rootScope.tab_meg_cnt.chat;

            socket.emit('update_badge',{badge:badge});
        }

        //채팅 메시지
        if(data.message_list.length > 0){
            //메시지 목록, 위 아래 메시지 날짜 다르면 타임스템프 넣어주기
            data.message_list.reduce(function(pre,cur){
                if(pre.time.substring(0,10) != cur.time.substring(0,10)){
                    cur.time_stamp = cur.time.substring(0,10);
                }
                return cur;
            });
        } else {
            data.message_list.push({
                message : '채팅을 시작해보세요.',
                sender : 'system',
                time : new Date().toDateString(),
                num : 0
            });
        }

        $scope.chat_room_info.message_list = data.message_list

        setChatRoomName();
    }

    //채팅방 이름 설정
    function setChatRoomName() {
        var room_name = '';
        if($scope.chat_room_info.member_list.length > 2){
            room_name = '그룹채팅'+$scope.chat_room_info.member_list.length;
        } else if($scope.chat_room_info.member_list == 1){
            room_name = '대화상대 없음';
        } else {
            var member_names = [];
            $scope.chat_room_info.member_list.forEach(function (item) {
                if(item.name != $rootScope.user_info.name)
                    member_names.push(item.name);
            });
            room_name = member_names.join(',');
        }
        $scope.chat_room_info.room_name = room_name;
    }

    //메시지 전송
    $scope.send_message = function () {

        if($scope.msgTxt.length != 0){
            $scope.showSendLoading = true;
            socket.emit('send_message',{
                me : $rootScope.user_info.id,
                name : $rootScope.user_info.name,
                room_code : $scope.chat_room_info.room_code,
                message : $scope.msgTxt
            },function (res) {
                if(res.num){
                    $scope.msgTxt = '';
                } else {
                    $scope.msgTxt = '';
                    $scope.reconnect();
                }
            });
        }
    }

    //새로운 메시지 수신
    socket.on('new_message', function(data) {
        //console.log('new_message', JSON.stringify(data));
        //타임 스템프
        if (data.time.substring(0, 10) != $scope.chat_room_info.message_list[$scope.chat_room_info.message_list.length - 1].time.substring(0, 10)) {
            data.time_stamp = data.time.substring(0, 10);
        }
        $scope.chat_room_info.message_list.push(data);
        //$ionicScrollDelegate.scrollBottom();
        _scrollBottom();
    });

    //메시지 안 읽은 멤버 목록 모달
    $ionicModal.fromTemplateUrl('templates/chat/modal/unReadMember.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function (modal) {
        $scope.unReadMemberModal = modal;
    });

    //메시지 안 읽은 사람 보기
    $scope.who_un_read_message = function (num) {
        $ionicLoading.show({
            template: '<ion-spinner></ion-spinner><br>불러오는중..'
        });
        socket.emit('who_read_message',{num:num},function(read_member){

            $scope.un_read_member = $scope.chat_room_info.member_list.filter(function (item) {
                if(read_member.indexOf(item.id) == -1 && item.start_num <= num){
                    return item;
                }
            });

            $scope.unReadMemberModal.show();
            $ionicLoading.hide();
        });
    }

    //메시지 더 요청
    $scope.more_message = function () {
        socket.emit('more_message',{last_num:$scope.chat_room_info.message_list[0].num},function(message_list){
            if(angular.isArray(message_list) && message_list.length > 0){
                for(var i in message_list){
                    $scope.chat_room_info.message_list.unshift(message_list[i]);
                }
                $scope.chat_room_info.message_list.reduce(function(pre,cur){
                    if(pre.time.substring(0,10) != cur.time.substring(0,10)){
                        cur.time_stamp = cur.time.substring(0,10);
                    }
                    return cur;
                });
            } else if(message_list == 'fail'){
                $scope.reconnect();
            } else {
                $cordovaDialogs.alert('더이상 메시지가 없습니다.', 'SchoolWare', '확인');
            }
            $scope.$broadcast('scroll.refreshComplete');
        });
    }

    //회원 검색 모달
    $ionicModal.fromTemplateUrl('templates/member/modal/selectMember_chatOrPush.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function (modal) {
        $scope.selectMemberModal = modal;
    });

    var delay_flag = true;//회원 검색에서 터치 실수 방지를 위한 딜레이 플래그
    $scope.meg_type = false; //회원 검색 모달에서 채팅 제목으로 보이기 위함
    //학과 목록
    major_info_list.all().then(function (major_list) {
        $scope.major_list = major_list;
    });
    $scope.MemberList = []; //회원 검색 결과
    $scope.selectMember = []; //선택 대상

    //검색 옵션
    $scope.searchOption = {
        major_code: $rootScope.user_info.major_code,
        s_auth: '1',
        s_state: '0',
        query: ''
    };

    //검색 옵션 변경 시 검색 결과 삭제
    $scope.clearSearchMember = function () {
        $scope.MemberList = [];
    }

    //회원검색
    $scope.searchMember = function () {
        //console.log('select',delay_flag);
        if(delay_flag){
            $cordovaKeyboard.close();
            MemberService.searchMember($scope.searchOption).then(function (data) {
                $scope.MemberList = [];
                $scope.MemberList = data.member.map(function (item) {
                    item.isPick = false;
                    return item;
                });
            });
        }
        delay_flag = false;
        $timeout(function(){
            delay_flag = true;
        }, 1000);
    }

    //회원 선택
    $scope.pickMember = function (member) {
        if(delay_flag){
            var flag = true;
            //이미 참여중인 사람인지 검사
            for(var i in $scope.chat_room_info.member_list){
                if($scope.chat_room_info.member_list[i].id == member.id){
                    flag = false;
                    $cordovaDialogs.alert('선택된 회원은 이미 채팅에 참여중입니다.', 'SchoolWare', '확인');
                    break;
                }
            }
            if(flag){
                //검색 결과에서 선택 체크박스로 변경
                for(var i in $scope.MemberList){
                    if($scope.MemberList[i].id == member.id){
                        $scope.MemberList[i].isPick = true;
                    }
                }
                $scope.selectMember.push(member);
            }
        }
    }

    //회원 선택 취소
    $scope.delPickMember = function (member) {
        if(delay_flag){
            $scope.selectMember.splice($scope.selectMember.indexOf(member), 1);
            for(var i in $scope.MemberList){
                if($scope.MemberList[i].id == member.id){
                    $scope.MemberList[i].isPick = false;
                }
            }
        }
    }

    $scope.pickAll = function() {
        delay_flag = false;
        $timeout(function(){
            delay_flag = true;
        }, 1000);
        $scope.selectMember = angular.copy($scope.MemberList);
        $scope.MemberList = $scope.MemberList.map(function (item) {
            item.isPick = true;
            return item;
        });

    }
    $scope.DisPickAll = function() {
        delay_flag = false;
        $timeout(function(){
            delay_flag = true;
        }, 1000);
        $scope.selectMember = [];
        $scope.MemberList = $scope.MemberList.map(function (item) {
            item.isPick = false;
            return item;
        });
    }

    //회원 검색 모달 닫기
    $scope.close_selectView = function () {
        $scope.MemberList = [];
        $scope.selectMember = [];
        $scope.selectMemberModal.hide();
    }

    //선택 회원 채팅방으로 초대
    $scope.done_select = function () {

        var names = [];
        var ids = [];
        for(var i in $scope.selectMember){
            names.push($scope.selectMember[i].name);
            ids.push($scope.selectMember[i].id);
        }
        //중복 검사를 위해 현재 멤버 id 배열 생성
        var cur_member_id = [];
        for(var i in $scope.chat_room_info.member_list){
            cur_member_id.push($scope.chat_room_info.member_list[i].id);
        }

        //중복 검사
        ids = ids.filter(function (item,index) {
            //중복 아닌 사람만 ids에 저장
            if(cur_member_id.indexOf(item) == -1){
                return item;
            } else {
                //중복이면 이름 삭제
                //id는 filter로 걸러짐
                names.splice(index,1);
            }
        });

        //초대 메시지 전송
        if(ids.length > 0){
            socket.emit('invite_member',{
                me : $rootScope.user_info.id,
                room_code : $scope.chat_room_info.room_code,
                ids : ids,
                names : names,
                message : $rootScope.user_info.name+'님이 '+names.join(',')+'님을 초대했습니다.'
            },function (res) {
                //console.log('invite_member',res);
                if(res == 'success'){
                    $scope.close_selectView();
                } else {
                    $cordovaDialogs.alert('잠시후 다시 시도해주세요.', 'SchoolWare', '확인');
                }
            });
        } else {
            $cordovaDialogs.alert('선택된 회원은 이미 채팅에 참여중입니다.', 'SchoolWare', '확인').then(function () {
                $scope.close_selectView();
            });
        }
    }

    //초대된 회원 방 정보에 추가
    socket.on('invite_member',function (data) {
        //console.log('invite_member',JSON.stringify(data));
        for(var i in data.ids){
            $scope.chat_room_info.member_list.push({
                id : data.ids[i],
                name : data.names[i]
            });
        }
        setChatRoomName();
    });

    //멤버중 누군가 채팅방 나가면
    socket.on('who_leave_room',function (target) {
        //console.log('who_leave_room',target.id);
        $scope.chat_room_info.member_list = $scope.chat_room_info.member_list.filter(function (item) {
            if(item.id != target.id){
                return item;
            }
        });
        setChatRoomName();
    });

    //대화 상대 목록 모달
    $ionicModal.fromTemplateUrl('templates/chat/modal/curMember.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function (modal) {
        $scope.curMemberModal = modal;
    });

    //대화 상대 목록 요청
    function cur_member_list() {
        socket.emit('cur_member_list',{room_code:$scope.chat_room_info.room_code},function(cur_member){
            $scope.chat_room_info.member_list = $scope.chat_room_info.member_list.map(function (item) {
                cur_member.indexOf(item.id) != -1 ? item.isAccess = true : item.isAccess = false;
                return item;
            });
            $scope.curMemberModal.show();
        });
    }

    //방이름 변경
    function edit_room_name() {
        $cordovaDialogs.prompt("변경할 이름을 작성해 주세요", "채팅방 이름 변경", ["확인", "취소"], "").then(function(result){
            if(result.buttonIndex == 1){
                $cordovaDialogs.confirm("'" + result.input1 + "'으로 방이름을 변경하시겠습니까?", "SchoolWare", ["변경", "취소"]).then(function(inButtonIndex){
                    if(inButtonIndex == 1){
                        chatFunction.insertRoomName($scope.chat_room_info.room_code, result.input1).then(function(){
                            $scope.chat_room_info.room_name = result.input1;
                        }).catch(function (err) {
                            console.log('채팅방 이름변경 에러',err);
                            $cordovaDialogs.alert('잠시후 다시 시도해주세요.', 'SchoolWare', '확인');
                        });
                    }
                });
            }
        });
    }

    //방 나가기 - 채팅방을 완전히 나감
    function leave_room() {
        $cordovaDialogs.confirm('채팅방에서 나가시겠습니까?\n대화내용이 모두 삭제되고\n채팅목록에서도 삭제됩니다.', 'SchoolWare', ['확인', '취소']).then(function (buttonIndex) {
            if (buttonIndex == 1) {
                socket.emit('leave_room',{me_name:$rootScope.user_info.name},function(res){
                    if(res.err){
                        $scope.reconnect();
                    } else {
                        //로컬에 저장된 채팅방 이름 삭제
                        chatFunction.deleteRoomName($scope.chat_room_info.room_code);
                        $scope.disconnect();
                    }
                });
            }
        });
    }

    //옵션 버튼
    $scope.optionBtn = function () {
        $ionicActionSheet.show({
            buttons: [
                {text:'<i class="icon ion-person-add positive"></i>대화 상대 초대'},
                {text:'<i class="icon ion-person-stalker positive"></i>대화 상대 보기'},
                {text:'<i class="icon ion-compose positive"></i>채팅방 이름 변경'},
                {text:'<i class="icon ion-log-out assertive"></i>채팅방 나가기'}
            ],
            cancelText: 'Cancel',
            cancel: function () {
                return true;
            },
            buttonClicked: function(index) {
                switch (index){
                    case 0:
                        $scope.selectMemberModal.show();
                        break;
                    case 1:
                        cur_member_list();
                        break;
                    case 2:
                        edit_room_name();
                        break;
                    case 3:
                        leave_room();
                        break;
                }
                return true;
            }
        });
    };

    var is_click_disconnect = false; //뒤로가기 버튼 클릭 했는지
    var is_back_ground = false; // 백그라운드 인지
    var is_reconnect = false;
    var click_chat_push = false; //채팅 푸시 클릭 해서 앱 실행 했는지
    var other_push_type = false; // 채팅 푸시인지

    //채팅방 연결 종료
    $scope.disconnect = function () {
        is_click_disconnect = true;
        socket.disconnect();
        $timeout(function(){
            pageCtrlFunction.goBack('tab.chatList', '', false); //뒤로가기
        },500);
    }

    //재접속
    $scope.reconnect = function () {
        is_reconnect = true;
        socket.reconnect();
        joinChatRoom();
        $timeout(function(){
            is_reconnect = false;
        },500);
    }

    socket.once('disconnect', function(){
        $timeout(function(){
            if(!is_click_disconnect && !is_back_ground && !is_reconnect){
                $cordovaDialogs.alert('채팅서버와 연결이 끊겼습니다.\n잠시후 다시 시도해주세요.', 'SchoolWare', '확인').then(function () {
                    $scope.disconnect();
                });
            }
        }, 1100);
    });

    //백그라운드에서 채팅 푸시가 클릭 했을 때 --> 해당 채팅방의 방코드 세팅
    $scope.$on('onPush',function (event,data) {
        if(!data.additionalData.foreground && data.additionalData.type == 'chat'){
            click_chat_push = data.additionalData.etc;
            other_push_type = false;
        } else if(!data.additionalData.foreground && data.additionalData.type != 'chat'){
            //채팅 푸시가 아니면 소켓 연결 못하게 flag 변경
            other_push_type = true;
        }
    });

    //포그라운드 백드라운드 체크
    $scope.$on('read', function(event, data){
        if(data){//포그라운드
            $timeout(function(){
                if(is_back_ground && !other_push_type){
                    is_back_ground = false;
                    socket.connect();
                    //푸시 클릭하면 click_chat_push 변수에 해당 방코드 들어감
                    click_chat_push == false ? joinChatRoom() : joinChatRoom(click_chat_push);
                }
            }, 1000);
        } else {//백그라운드
            is_back_ground = true;
            socket.disconnect();
        }
    });
    //안드로이드 하드웨어 뒤로가기 버튼
    $scope.$on('work_chat_back_btn', function(event, data){
        //console.log('work_chat_back_btn');
        $scope.disconnect();
    });

})

.controller('AccountCtrl', function($scope) {
  $scope.settings = {
    enableFriends: true
  };
});
