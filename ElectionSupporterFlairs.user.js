// ==UserScript==
// @name         Election Supporter Flairs
// @description  Flair users who voted in the elections when you were elected, or if non-mod, for the latest election
// @homepage     https://github.com/samliew/SO-mod-userscripts
// @author       @samliew
// @version      1.5.1
//
// @include      https://stackoverflow.com/*
// @include      https://serverfault.com/*
// @include      https://superuser.com/*
// @include      https://askubuntu.com/*
// @include      https://mathoverflow.net/*
// @include      https://*.stackexchange.com/*
// ==/UserScript==

(function() {
    'use strict';

    const store = window.localStorage;
    const myUserId = StackExchange.options.user.userId || 0;
    let electionNum, constituentBadgeId;


    function toInt(v) {
        const intVal = Number(v);
        return v == null || isNaN(intVal) ? null : intVal;
    }


    function toBool(v) {
        return v == null ? null : v === true || v.toLowerCase() === 'true';
    }


    function getConstituentBadgeId() {
        const keyroot = 'ConstituentBadgeId';
        const fullkey = `${keyroot}`;
        let v = toInt(store.getItem(fullkey));

        return new Promise(function(resolve, reject) {
            if(v != null) { resolve(v); return; }

            $.ajax(`/help/badges`)
                .done(function(data) {
                    const badges = $('.badge', data);
                    const cBadge = badges.filter((i,el) => $(el).text().indexOf('Constituent') >= 0);
                    v = Number(cBadge.attr('href').match(/\d+/)[0]);
                    store.setItem(fullkey, v);
                    resolve(v);
                })
                .fail(reject);
        });
    }


    function getLastElectionNum() {
        return new Promise(function(resolve, reject) {
            $.ajax(`/election/-1`)
                .done(function(data) {
                    const elections = $('table.elections tr', data);
                    const eLatest = elections.last().find('a').first().attr('href').match(/\d+$/)[0];
                    let v = Number(eLatest);
                    resolve(v);
                })
                .fail(reject);
        });
    }


    function getUserElectionNum(uid) {
        const keyroot = 'UserElectionNum';
        const fullkey = `${keyroot}:${uid}`;
        let v = toInt(store.getItem(fullkey));

        return new Promise(function(resolve, reject) {
            if(v != null) { resolve(v); return; }

            $.ajax(`/users/history/${uid}?type=Promoted+to+moderator+for+winning+an+election`)
                .done(function(data) {
                    const hist = $('#user-history tbody tr', data);
                    const eNum = hist.first().children().eq(2).text().match(/\d+/)[0];
                    v = Number(eNum);
                    store.setItem(fullkey, v);
                    resolve(v);
                })
                .fail(reject);
        });
    }


    function getUserParticipationForElection(uid, electionNum) {
        const keyroot = 'UserParticipationForElection' + electionNum;
        const fullkey = `${keyroot}:${uid}`;
        let v = toBool(store.getItem(fullkey));

        return new Promise(function(resolve, reject) {
            if(v != null) { resolve(v); return; }

            $.get(`/help/badges/${constituentBadgeId}/constituent?userid=${uid}`)
                .done(function(data) {
                    v = $(`.single-badge-reason a[href$="${electionNum}"]`, data).length == 1;
                    store.setItem(fullkey, v);
                    resolve(v);
                })
                .fail(reject);
        });
    }


    function getUsersParticipationForElection(uids, electionNum) {

        // For each group of userIds
        uids.forEach(uid =>
            // Get user participation for each user
            getUserParticipationForElection(uid, electionNum).then(function(v) {
                // Flair user if voted in the elections
                if(v) $('.user-details, .comment-body, .question-status').find(`a[href^="/users/${uid}/"]`).addClass('election-supporter');
            })
        );
    }


    function initUserElectionParticipation() {

        // Get all unique users on page except own
        let userIds = $('a[href^="/users/"]').map((i, el) => $(el).attr('href').match(/\d+/)[0]).get();
        userIds = userIds.filter(function(value, index, self) {
            return self.indexOf(value) === index && value !== myUserId.toString();
        });

        // Stagger ajax calls using timeouts
        for(var i = 0; i < Math.ceil(userIds.length / 10); i++) {
            setTimeout(
                uids => getUsersParticipationForElection(uids, electionNum),
                3000 * i,
                userIds.slice(i * 10, i * 10 + 10)
            );
        }
    }


    function doPageload() {

        // We need the site's constituentBadgeId to proceed
        getConstituentBadgeId().then(function(v) {
            constituentBadgeId = v;

            // Which election number to use depends whether user is mod
            let promise = StackExchange.options.user.isModerator ? getUserElectionNum(myUserId) : getLastElectionNum();
            promise.then(function(v) {
                electionNum = v;

                console.log('constituentBadgeId: ' + constituentBadgeId);
                console.log('electionNum: ' + electionNum);

                // Validate required ids before continuing
                if(!isNaN(constituentBadgeId) && !isNaN(electionNum)) initUserElectionParticipation();
            });
        });
    }


    function appendStyles() {

        var styles = `
<style>
.election-supporter:after {
    content: '■';
    position: relative;
    top: -2px;
    margin-left: 3px;
    font-size: 12px;
    line-height: 1;
    color: #5A5;
}
</style>
`;
        $('body').append(styles);
    }


    // On page load
    appendStyles();
    doPageload();

})();


unsafeWindow.lsRemoveItemsWithPrefix = function(prefix) {
    const store = window.localStorage;
    let count = 0;
    for(let i = store.length - 1; i >= 0; i--) {
        const key = store.key(i);
        if(key && key.indexOf(prefix) === 0) {
            store.removeItem(key);
            count++;
        }
    }
    console.log(count + ' items cleared');
    return count;
};


unsafeWindow.purgeElectionSupporterFlairs = function() {
    lsRemoveItemsWithPrefix('LastElectionNum');
    lsRemoveItemsWithPrefix('UserElectionNum');
    lsRemoveItemsWithPrefix('UserParticipationForElection');
};
