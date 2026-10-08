"use strict";

/* =========================================================
   LIGHTHOUSE KTV SONG LIST
   ---------------------------------------------------------
   - "track" = file number on the audio module SD card
     (DFPlayer Mini: /mp3/0001.mp3, 0002.mp3, ...)
   - "lines" = lyric lines with the second they appear.
   The same list should be copied to the ESP 2 firmware so
   the 1.8" TFT shows identical lyrics.

   NOTE: "You Are My Sunshine" is still under copyright, so
   its lyrics are not included here. Add your own licensed
   lyrics in its "lines" array if needed.
========================================================= */

window.KTV_SONGS = [
    {
        track: 1,
        title: "You Are My Sunshine",
        artist: "Jimmie Davis",
        lines: [
            { t: 0, text: "♪ You Are My Sunshine ♪" },
            { t: 4, text: "(Add the lyrics in js/ktv-songs.js)" }
        ],
        duration: 60
    },
    {
        track: 2,
        title: "Bahay Kubo",
        artist: "Filipino Folk Song",
        lines: [
            { t: 0, text: "♪ Bahay Kubo ♪" },
            { t: 3, text: "Bahay kubo, kahit munti" },
            { t: 7, text: "Ang halaman doon ay sari-sari" },
            { t: 11, text: "Singkamas at talong, sigarilyas at mani" },
            { t: 15, text: "Sitaw, bataw, patani" },
            { t: 19, text: "Kundol, patola, upo't kalabasa" },
            { t: 23, text: "At saka mayroon pang labanos, mustasa" },
            { t: 27, text: "Sibuyas, kamatis, bawang at luya" },
            { t: 31, text: "Sa paligid-ligid ay puno ng linga" }
        ],
        duration: 36
    },
    {
        track: 3,
        title: "Leron Leron Sinta",
        artist: "Filipino Folk Song",
        lines: [
            { t: 0, text: "♪ Leron Leron Sinta ♪" },
            { t: 3, text: "Leron, leron sinta" },
            { t: 6, text: "Buko ng papaya" },
            { t: 9, text: "Dala-dala'y buslo" },
            { t: 12, text: "Sisidlan ng bunga" },
            { t: 15, text: "Pagdating sa dulo" },
            { t: 18, text: "Nabali ang sanga" },
            { t: 21, text: "Kapos kapalaran" },
            { t: 24, text: "Humanap ng iba" }
        ],
        duration: 28
    },
    {
        track: 4,
        title: "Twinkle, Twinkle, Little Star",
        artist: "Traditional",
        lines: [
            { t: 0, text: "♪ Twinkle, Twinkle, Little Star ♪" },
            { t: 3, text: "Twinkle, twinkle, little star" },
            { t: 7, text: "How I wonder what you are" },
            { t: 11, text: "Up above the world so high" },
            { t: 15, text: "Like a diamond in the sky" },
            { t: 19, text: "Twinkle, twinkle, little star" },
            { t: 23, text: "How I wonder what you are" }
        ],
        duration: 28
    },
    {
        track: 5,
        title: "Happy Birthday",
        artist: "Traditional",
        lines: [
            { t: 0, text: "♪ Happy Birthday ♪" },
            { t: 2, text: "Happy birthday to you" },
            { t: 6, text: "Happy birthday to you" },
            { t: 10, text: "Happy birthday, dear guest" },
            { t: 14, text: "Happy birthday to you!" }
        ],
        duration: 19
    },
    {
        track: 6,
        title: "Row, Row, Row Your Boat",
        artist: "Traditional",
        lines: [
            { t: 0, text: "♪ Row, Row, Row Your Boat ♪" },
            { t: 3, text: "Row, row, row your boat" },
            { t: 6, text: "Gently down the stream" },
            { t: 9, text: "Merrily, merrily, merrily, merrily" },
            { t: 13, text: "Life is but a dream" }
        ],
        duration: 18
    }
];
