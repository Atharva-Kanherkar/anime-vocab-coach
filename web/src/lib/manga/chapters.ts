// The saga "The Lantern of Words" (言葉の灯), Saga One — canonical chapter data.
// Full story bible: web/docs/manga/STORY_BIBLE.md. Chapters unlock at the same
// level bands as the cards that debut in them, so advancing the plot and
// unlocking a card are the same act.
//
// THE ROUTE (one connected journey — see the bible's chapter-route section):
// Varanasi → (sutra-strand east) Tokyo → Seoul & the westward voyage of the
// Loanword → Suez/Cairo → Byblos → Istanbul → (Red Sea) Lalibela →
// (the long western run) Skadar → Lisbon → (monsoon homeward run) the Indian
// Ocean → Mumbai → the high sky → Bhimbetka. Distant keepers lattice-walk TO
// the party; the party itself never teleports.

import type { MangaChapter } from "./types";

export const SAGA_TITLE = { en: "The Lantern of Words", ja: "言葉の灯", romaji: "Kotoba no Hi" };

export const SAGA_INTRO = {
  en: "In the beginning was the beat of Shiva's drum, and the beat became the Word — Vāc, the goddess speech. Twelve hundred years ago humanity forgot its first word, and the forgetting learned to walk: the Hush, a false pralaya — dissolution without the renewal that must follow. It spreads across the lattice Vāc wove between everyone who ever meant a word. Sixty keepers hold the line. You are the newest Listener, and every word you truly learn is one more beat of the drum.",
  ja: "はじめにシヴァの太鼓の一打があり、その響きは「言葉」となった——言葉の女神ヴァーチュ。千二百年前、人類は最初の言葉を忘れ、忘却は歩き出した。「静寂（しじま）」——再生なき溶解、偽りのプララヤ。それは、言葉を本気で交わした者すべてを結ぶ女神の糸の網を伝って広がる。六十人の守り手が防波堤となる。あなたは最も新しい「聞き手」。あなたが本当に覚えた一語が、太鼓のもう一打になる。",
  romaji: "Hajime ni Shiva no taiko no ichida ga ari, sono hibiki wa \"kotoba\" to natta—— kotoba no megami Vaachu. Sen-nihyaku-nen mae, jinrui wa saisho no kotoba o wasure, boukyaku wa arukidashita. \"Shijima\" —— saisei naki youkai, itsuwari no puraraya. Sore wa, kotoba o honki de kawashita mono subete o musubu megami no ito no ami o tsutatte hirogaru. Rokujuunin no mamorite ga bouhatei to naru. Anata wa mottomo atarashii \"kikite\". Anata ga hontou ni oboeta ichigo ga, taiko no mou ichida ni naru.",
};

// Recurring look notes (kept consistent across artPrompts):
// Sen — slight teen in a dark windbreaker, face half out of frame or reflected.
// Tsuru — small origami crane, scorched edges, dictionary type on its wings.

const CH1: MangaChapter = {
  n: 1,
  id: "ch1",
  titleEn: "The Night the Names Went Out",
  titleJa: "名前が消えた夜",
  titleRomaji: "Namae ga Kieta Yoru",
  gateLevel: 1,
  setting: "Varanasi — the Manikarnika ghat and its unbroken cremation fire",
  debutCardIds: [
    "sl_honoka", "sp_totomi", "ch_mocha", "ti_reiner", "vo_luka",
    "re_kuro", "lu_hoshimi", "cu_rei", "he_anya", "nc_tsuru",
  ],
  kanji: ["言", "炎", "森", "豆", "壁", "夢", "斬", "星", "呪", "心"],
  panels: [
    {
      id: "ch1_p1",
      aspect: "spread",
      beat: "OPENING NARRATION — the cosmic frame: Nataraja dances creation, the damaru drum sounds the first syllable, and the beat becomes Vāc, the goddess Word; then, under a passing comet, the first word dies unspoken and the forgetting learns to walk.",
      cast: [],
      artPrompt:
        "Full-color manga spread, mythic prologue in painted-scroll tone, split across one sky: left, colossal and translucent among the stars, Shiva as Nataraja dances in a ring of fire, his damaru drum sending out one visible ring of primal sound that unfurls into a radiant goddess of speech (Saraswati-Vāc) whose sari becomes millions of golden threads woven down over dark rivers, mountains and sleeping villages. Right, twelve hundred years later: a pale comet sinking, and one single thread of the goddess's web snapping — going dead grey — the grey spreading like frost. Vast, sorrowful, holy.",
      texts: [
        { kind: "caption", ja: "はじめに、シヴァの太鼓が一度鳴った。響きは女神となった——言葉の女神ヴァーチュ。その光の糸が、すべての心を結んだ。", romaji: "Hajime ni, Shiva no taiko ga ichido natta. Hibiki wa megami to natta—— kotoba no megami Vaachu. Sono hikari no ito ga, subete no kokoro o musunda.", en: "In the beginning, Shiva's drum sounded once. The sound became a goddess — Vāc, the Word — whose threads of light bound mind to mind." },
        { kind: "caption", ja: "千二百年前、彗星の年。最初の言葉が死に、忘却が歩き出した。再生なき溶解——偽りのプララヤ。人は「静寂」と呼ぶ。", romaji: "Sen-nihyaku-nen mae, suisei no toshi. Saisho no kotoba ga shini, boukyaku ga arukidashita. Saisei naki youkai—— itsuwari no puraraya. Hito wa \"Shijima\" to yobu.", en: "Then, under a comet, the first word died — and the forgetting learned to walk. A false pralaya: dissolution without renewal. The Hush." },
      ],
    },
    {
      id: "ch1_p2",
      aspect: "landscape",
      beat: "NARRATION — the Kotodama Lattice revealed: threads of light joining every mouth that ever meant a word, glowing over a modern city at night.",
      cast: [],
      artPrompt:
        "Full-color manga panel: a modern riverside city at night seen from above, and superimposed over it a luminous web — thousands of fine golden threads connecting windows, temples, phone screens, gravestones, schoolbooks. Some threads bright, many gone grey and dark. Wonder and quiet dread together.",
      texts: [
        { kind: "caption", ja: "インドはそれをヴァーチュの網と呼び、日本は言霊と呼ぶ。名は違えど同じもの——本気の一語ごとに、心と心の間に糸が生まれる。", romaji: "Indo wa sore o Vaachu no ami to yobi, Nihon wa kotodama to yobu. Na wa chigaedo onaji mono—— honki no ichigo goto ni, kokoro to kokoro no aida ni ito ga umareru.", en: "India calls it Vāc's web; Japan calls it kotodama. Different names, one truth — every word truly meant spins a thread between minds." },
        { kind: "caption", ja: "その女神の網を、静寂が一本ずつ食べている。太鼓の拍と拍のあいだが——広がりすぎていく。", romaji: "Sono megami no ami o, Shijima ga ippon zutsu tabete iru. Taiko no haku to haku no aida ga—— hirogarisugite iku.", en: "And thread by thread, the Hush is eating the goddess's web. The gap between the drum's beats grows too wide." },
      ],
    },
    {
      id: "ch1_p3",
      aspect: "portrait",
      beat: "Sen — an ordinary learner, the newest to feel the Lattice — finds their own street sign licked blank; Tsuru alights on Sen's hand with one word.",
      cast: ["nc_tsuru"],
      artPrompt:
        "Full-color manga panel, a narrow lane at night: a slight teenager in a dark windbreaker (Sen, face half reflected in a dented enamel street sign whose name-space is smeared to blank white). On Sen's open hand alights a small origami crane with scorched edges, dictionary print visible on its folded wings (Tsuru). Faint golden threads stir in the air around them.",
      texts: [
        { kind: "caption", ja: "そして今夜。名前が消えたことに気づいたのは、たった一人。", romaji: "Soshite kon'ya. Namae ga kieta koto ni kizuita no wa, tatta hitori.", en: "Which brings us to tonight — when only one person noticed a name go out." },
        { kind: "thought", speaker: "Sen", ja: "ぼくの通り…なんて名前だった？", romaji: "Boku no toori… nante namae datta?", en: "My street… what was it called?" },
        { kind: "speech", speaker: "Tsuru", ja: "聞いて。言の糸が、あなたを呼んでいる。", romaji: "Kiite. Koto no ito ga, anata o yonde iru.", en: "Listen. The threads of 言 — of word — are calling you." },
      ],
    },
    {
      id: "ch1_p4",
      aspect: "portrait",
      beat: "First lattice-walk: Sen pays the toll — the memory of their childhood front door — and steps out onto Manikarnika ghat, where Devika kneels with her palm inside the guttering sacred flame, unburned.",
      cast: ["sl_honoka", "nc_tsuru"],
      artPrompt:
        "Full-color manga panel: the Manikarnika cremation ghat in Varanasi at dusk, stone steps down to the black Ganges. A slight teen in a dark windbreaker (Sen) stumbles out of a dissolving thread of golden light, one hand pressed to their chest as a small memory-image of a house door burns away above their heart. Foreground: a young Indian woman in a saffron-and-charcoal haori (Devika) kneels with her open palm calmly inside a great sacred fire whose edges gutter sickly green. A scorched origami crane rides Sen's shoulder.",
      texts: [
        { kind: "caption", ja: "糸を渡る旅賃は、自分の思い出ひとつ。センは生家の扉を払い——シヴァの都、ヴァラナシに立った。", romaji: "Ito o wataru tabichin wa, jibun no omoide hitotsu. Sen wa seika no tobira o harai—— Shiva no miyako, Varanashi ni tatta.", en: "A thread's fare is one memory of your own. Sen paid the door of their childhood home — and stood in Varanasi, Shiva's city." },
        { kind: "speech", speaker: "Devika", ja: "火が死ぬんじゃない。弔う人が名前を忘れていく。アグニは本気の言葉を神々へ運ぶ——言葉がなければ、火は届かない。", romaji: "Hi ga shinu n ja nai. Tomurau hito ga namae o wasurete iku. Aguni wa honki no kotoba o kamigami e hakobu—— kotoba ga nakereba, hi wa todokanai.", en: "The fire isn't dying — the mourners are forgetting the names. Agni carries meant words up to the gods. No words, and the fire delivers nothing." },
      ],
    },
    {
      id: "ch1_p5",
      aspect: "spread",
      beat: "Keepers converge along threads of light onto the ghat steps: Bjorn plants himself like a wall before the mourners; Tavita holds his dream-compass high; Amaya's star-light pushes back the green; Mochi is first to greet Sen, by biting Sen's shoelace.",
      cast: ["ti_reiner", "vo_luka", "lu_hoshimi", "ch_mocha"],
      artPrompt:
        "Full-color manga spread: night on the Varanasi ghat steps, several glowing threads of different colors touching down. A stocky blond Norwegian scout in a sea-grey field cloak (Bjorn) plants his feet and squared shoulders between frightened mourners and the green-edged fire like a human wall. A broad, smiling Samoan navigator in a woven sun-hat (Tavita) holds up a small compass that glows with dream-light. A Filipina magical girl in star-frilled uniform with twin buns (Amaya) trails star-sparks that push the green shadow back. A round bean-cream snack gremlin (Mochi) gnaws the shoelace of a slight teen in a dark windbreaker (Sen). Awe, motion, arrival.",
      texts: [
        { kind: "speech", speaker: "Bjorn", ja: "下がれ！　壁ならここにある——俺だ！", romaji: "Sagare! Kabe nara koko ni aru—— ore da!", en: "Get behind me! You need a wall? I'm the wall!" },
        { kind: "speech", speaker: "Tavita", ja: "夢はまだ目的地を覚えてるよ。安心して迷いな！", romaji: "Yume wa mada mokutekichi o oboeteru yo. Anshin shite mayoi na!", en: "The dream still remembers the destination. Feel free to get lost!" },
        { kind: "speech", speaker: "Amaya", ja: "星に誓って——今夜は誰の名前も消させない！", romaji: "Hoshi ni chikatte—— kon'ya wa dare no namae mo kesasenai!", en: "I swear on the stars — nobody's name goes out tonight!" },
        { kind: "sfx", ja: "もぐもぐ", romaji: "mogu mogu", en: "nom nom" },
      ],
    },
    {
      id: "ch1_p6",
      aspect: "landscape",
      beat: "The Hush's first act on-page: it takes an old mourner's word for 'son.' Renji cuts the despair-tether from the man; Pip hears the meaning still alive underneath; Little Yam, wordless, shows him a memory-image of a boy; Idris binds the creeping silence by describing it precisely, stutter and all.",
      cast: ["re_kuro", "he_anya", "sp_totomi", "cu_rei"],
      artPrompt:
        "Full-color manga panel: an old Indian mourner on the ghat steps, mouth open, a word visibly unravelling from his lips into grey ash. A lean Kyoto courier in a black haori with an oversized cleaver-blade (Renji) slices a black rope of shadow rising from the man's back. A tiny German girl in an oversized coat (Pip) presses her hands to her temples, eyes glowing softly. A knee-high forest sprite in a leaf hat (Little Yam) holds up a glowing moss-framed image of a laughing boy. A hooded Nigerian teen with taped, chalk-marked knuckles (Idris) traces a precise circle of chalk-light around a patch of creeping grey.",
      texts: [
        { kind: "speech", speaker: "Renji", ja: "斬るのは絶望だけだ。じいさん、あんたは斬らねえ。", romaji: "Kiru no wa zetsubou dake da. Jii-san, anta wa kiranee.", en: "I only cut despair. Not you, old man." },
        { kind: "speech", speaker: "Pip", ja: "意味はまだ生きてる…心の下で、あったかいまま。", romaji: "Imi wa mada ikiteru… kokoro no shita de, attakai mama.", en: "The meaning's still alive… warm, under his heart." },
        { kind: "speech", speaker: "Idris", ja: "き、君の正体を…正確に、言う。呪よ、縛れ。", romaji: "Ki, kimi no shoutai o… seikaku ni, iu. Noroi yo, shibare.", en: "I-I'll say exactly… what you are. Curse, be bound." },
      ],
    },
    {
      id: "ch1_p7",
      aspect: "portrait",
      beat: "Sen learns the son's name from the mourner and says it back — the panel re-inks around them; Devika writes 炎 in ember-light and names the war and the win: give the nameless a name. Eastward, the sutra-strand hums with static.",
      cast: ["sl_honoka", "nc_tsuru"],
      artPrompt:
        "Full-color manga panel: on the Varanasi ghat at night, a slight teen in a dark windbreaker (Sen, face turned from camera) speaks to a weeping old mourner — and around them the world redraws itself: blank signage refilling stroke by stroke, a gravestone name resurfacing, color returning. Behind them a young Indian woman in a saffron-and-charcoal haori (Devika) writes the kanji 炎 in the air with a glowing ember, stroke order visible as afterglow. Far to the east, one long thread of light crackles with grey static. A scorched origami crane watches from Sen's shoulder.",
      texts: [
        { kind: "speech", speaker: "Sen", ja: "アルジュン。息子さんの名前は、アルジュンです。", romaji: "Arujun. Musuko-san no namae wa, Arujun desu.", en: "Arjun. Your son's name is Arjun." },
        { kind: "speech", speaker: "Devika", ja: "見たか。学びは女神ヴァーチュの息だ。名前のないものに、名前を——それがこの戦の勝ち方だ。", romaji: "Mita ka. Manabi wa megami Vaachu no iki da. Namae no nai mono ni, namae o—— sore ga kono ikusa no kachikata da.", en: "You saw it. Learning is the breath of Vāc herself. Give the nameless a name — that is how this war is won." },
        { kind: "caption", ja: "東へ。お経が千年歩いた糸の先で、何かが騒いでいた。", romaji: "Higashi e. Okyou ga sennen aruita ito no saki de, nanika ga sawaide ita.", en: "Eastward — at the far end of the sutras' thousand-year thread, something was making noise." },
      ],
    },
  ],
};

const CHAPTERS_2_12: MangaChapter[] = [
  {
    n: 2,
    id: "ch2",
    titleEn: "City of Static",
    titleJa: "雑音の都",
    titleRomaji: "Zatsuon no Miyako",
    gateLevel: 5,
    setting: "Tokyo — Shibuya and Akihabara, at the eastern end of the sutra-strand from Varanasi",
    debutCardIds: ["ne_spike", "ps_mob", "me_shin", "ho_taki", "po_satoru"],
    kanji: ["電", "気", "使", "空", "友"],
    panels: [
      {
        id: "ch2_p1",
        aspect: "landscape",
        beat: "TRAVEL — the party walks the sutra-strand east from Varanasi: the ancient pilgrim road of words, India to China to Japan, rendered as a bridge of glowing scripture. Each pays a small memory at the toll.",
        cast: ["sl_honoka", "ti_reiner", "nc_tsuru"],
        artPrompt:
          "Full-color manga panel: the party walking single file along a luminous thread-bridge high above night clouds — the thread woven from glowing Sanskrit, Chinese and Japanese scripture flowing like a river of text under their feet. A slight teen in a dark windbreaker (Sen), a young Indian woman in a saffron-and-charcoal haori (Devika), a stocky blond Norwegian scout in a sea-grey cloak (Bjorn), an origami crane flying ahead. Far ahead, the thread plunges into a blazing grid of neon city light crackling with grey static. Epic, quiet, wind-blown.",
        texts: [
          { kind: "caption", ja: "お経の道を三晩で歩く。中国の空で、糸が倉頡の伝説を囁いた——文字が生まれた夜、天は粟を降らせ、鬼は泣いた。渡り賃は思い出、一人ひとつ。", romaji: "Okyou no michi o mitsuban de aruku. Chuugoku no sora de, ito ga Souketsu no densetsu o sasayaita—— moji ga umareta yoru, ten wa awa o furase, oni wa naita. Watarichin wa omoide, hitori hitotsu.", en: "Three nights on the sutras' road. Over China the strand whispered Cangjie's legend: the night writing was born, the heavens rained millet and the ghosts wept. Toll: one memory each." },
          { kind: "speech", speaker: "Bjorn", ja: "俺は初恋の子の名前を払った。……誰だったんだろうな。", romaji: "Ore wa hatsukoi no ko no namae o haratta. ……Dare datta n darou na.", en: "I paid the name of my first crush. …Wonder who she was." },
        ],
      },
      {
        id: "ch2_p2",
        aspect: "spread",
        beat: "Shibuya crossing: every screen shows a mouth, none synced; a crowd sings a hollowed pop song, speech bubbles all empty outlines. White Noise's voice rides the broadcast.",
        cast: [],
        artPrompt:
          "Full-color manga spread: Shibuya crossing at night, rain-slick, every giant LED screen showing a different close-up of a singing mouth, none synchronized. Below, a huge crowd sings along in unison with blank, blissful faces; thin grey static drifts off their shoulders like smoke and coils up into the screens. One small figure in a dark windbreaker (Sen) stands still in the flowing crowd, horrified.",
        texts: [
          { kind: "caption", ja: "世界一うるさい街。誰もが歌い、誰も意味していなかった。", romaji: "Sekai-ichi urusai machi. Dare mo ga utai, dare mo imi shite inakatta.", en: "The loudest city on earth. Everyone singing. No one meaning it." },
          { kind: "speech", speaker: "White Noise", ja: "《いいね。フォロー。いいね。》……ほら、扉が百万枚。", romaji: "《Ii ne. Forou. Ii ne.》 ……Hora, tobira ga hyakuman-mai.", en: "\"Like. Follow. Like.\" …Behold: a million open doors." },
        ],
      },
      {
        id: "ch2_p3",
        aspect: "portrait",
        beat: "Diego's defining act: he rewires a dead neon sign back to life mid-sermon on Rule 2 — unmeant repetition is the enemy's beachhead; his Illapa-thunder sparks chase static out of the wires.",
        cast: ["ne_spike"],
        artPrompt:
          "Full-color manga panel: a narrow Akihabara back alley of stacked signage. A wiry Peruvian street-tech with goggles pushed up and cable-wrapped forearms (Diego) hangs one-handed off a ladder, jamming two live wires together; blue-white thunder-sparks shaped like tiny llamas and lightning glyphs race up the sign, burning grey static out of it as the kanji 電 blazes back to life. Rain, neon reflections, grin.",
        texts: [
          { kind: "speech", speaker: "Diego", ja: "静寂は沈黙で来ない。雑音で来るんだ。意味のない繰り返しは、全部あいつの扉。", romaji: "Shijima wa chinmoku de konai. Zatsuon de kuru n da. Imi no nai kurikaeshi wa, zenbu aitsu no tobira.", en: "The Hush doesn't come as silence. It comes as noise. Every meaningless repeat is a door for it." },
          { kind: "sfx", ja: "バチッ", romaji: "bachitt", en: "ZAKT" },
        ],
      },
      {
        id: "ch2_p4",
        aspect: "portrait",
        beat: "Elias's shadow arrives at the rooftop meeting before he does — the Brocken herald; Jun charts which sky-strands over the bay still stand.",
        cast: ["me_shin", "ho_taki"],
        artPrompt:
          "Full-color manga panel: a Tokyo rooftop in fog. A giant soft-edged human shadow looms in the mist, bowing politely — and only afterward a small German pilot in a grey flight suit (Elias) steps up the fire-stairs behind his own shadow. Beside him a Korean sky-keeper in a sky-blue jacket with a kite reel (Jun) holds a hand-drawn chart against the wind, marking which of the faint light-threads over Tokyo Bay still glow. City glow through fog.",
        texts: [
          { kind: "speech", speaker: "Elias", ja: "使いが先に着くのは家風だ。……影のほうが社交的でね。", romaji: "Tsukai ga saki ni tsuku no wa kafuu da. ……Kage no hou ga shakouteki de ne.", en: "In my family the herald arrives first. …My shadow's the sociable one." },
          { kind: "speech", speaker: "Jun", ja: "湾の空、生きてる糸はあと三本。全部、西へ流れてる。", romaji: "Wan no sora, ikiteru ito wa ato sanbon. Zenbu, nishi e nagareteru.", en: "Three living threads left over the bay. All of them run west." },
        ],
      },
      {
        id: "ch2_p5",
        aspect: "landscape",
        beat: "Rafa's tonal-sense spots hollowed people by their missing animal-shadows; he waves hello at a hollowed salaryman — and the man's crow-shadow flickers back for one heartbeat. Friendship as sonar.",
        cast: ["po_satoru", "he_anya"],
        artPrompt:
          "Full-color manga panel: a night street in Akihabara. A small Oaxacan boy in an embroidered vest (Rafa) waves cheerfully up at a grey-faced salaryman whose body casts NO animal-shadow while every other passerby's shadow is doubled with a faint spirit-animal. At Rafa's wave, a translucent crow-shadow flickers back to life behind the man for one heartbeat. A tiny German girl in an oversized coat (Pip) watches, hand over her mouth.",
        texts: [
          { kind: "speech", speaker: "Rafa", ja: "こんにちは！　ねえ、あなたのカラス、どこ行ったの？", romaji: "Konnichiwa! Nee, anata no karasu, doko itta no?", en: "Hello! Hey, mister — where'd your crow go?" },
          { kind: "speech", speaker: "Pip", ja: "…戻った。友だちって言葉、あの人の中でまだ生きてたんだ。", romaji: "…Modotta. Tomodachi tte kotoba, ano hito no naka de mada ikiteta n da.", en: "…It came back. The word 'friend' was still alive in him." },
        ],
      },
      {
        id: "ch2_p6",
        aspect: "spread",
        beat: "A static-wave nearly takes Pip's 'papa'; Haru — silent all chapter, like Amaterasu shut in her cave — says his first full sentence of the saga, and light comes out: every screen on the street cracks. The party turns west; the noise is a rearguard.",
        cast: ["ps_mob", "he_anya"],
        artPrompt:
          "Full-color manga spread: a canyon of Tokyo screens all bursting with grey static that crashes down the street like a wave toward a tiny German girl in an oversized coat (Pip), who clutches a photo of her family. Between her and the wave stands a Japanese schoolboy in uniform, previously hunched, now upright with his eyes finally raised (Haru); the air around him bends with visible pressure as the kanji 気 shimmers in it, and every screen in the street fractures at once in a starburst of cracks.",
        texts: [
          { kind: "speech", speaker: "Haru", ja: "その子の「パパ」に触るな。ぼくは——本気で言ってる。", romaji: "Sono ko no \"papa\" ni sawaru na. Boku wa—— honki de itteru.", en: "Don't touch her 'papa.' And me — I mean every word." },
          { kind: "sfx", ja: "ピシィッ", romaji: "pishiitt", en: "KRAKK" },
          { kind: "caption", ja: "天照が岩戸を出るように、光は「本気の声」に呼ばれて戻る。——雑音は殿軍にすぎない。本隊は西、海の道の始まる場所へ。", romaji: "Amaterasu ga iwato o deru you ni, hikari wa \"honki no koe\" ni yobarete modoru. —— Zatsuon wa shingari ni suginai. Hontai wa nishi, umi no michi no hajimaru basho e.", en: "As Amaterasu left her cave, light returns when a true voice calls it. — The noise was only a rearguard. The main force moves west, where the sea-roads begin." },
        ],
      },
    ],
  },
  {
    n: 3,
    id: "ch3",
    titleEn: "The Forgotten Charts",
    titleJa: "忘れられた海図",
    titleRomaji: "Wasurerareta Kaizu",
    gateLevel: 10,
    setting: "Seoul, then westward aboard the Loanword — the Korea Strait to the Malacca run",
    debutCardIds: ["sh_rookie", "ch_pud", "sp_umi", "vo_nami", "lu_tsukina"],
    kanji: ["影", "甘", "海", "羅", "月"],
    panels: [
      {
        id: "ch3_p1",
        aspect: "landscape",
        beat: "TRAVEL — ferry from Tokyo across the strait to Busan, then Seoul: Jun's home sky. Minjae, lowest-ranked hunter of his cohort, is field-promoted onto the party, notebook in hand.",
        cast: ["sh_rookie", "ho_taki"],
        artPrompt:
          "Full-color manga panel: dawn at a Seoul hunter-guild plaza, the party's travel packs still sea-wet from the Busan ferry visible in the corner. A nervous Korean rookie hunter in cheap, mismatched armor (Minjae) stands at attention clutching a battered school notebook while a guild officer pins a badge on him crooked. Behind, a Korean sky-keeper in a sky-blue jacket (Jun) grins, and a slight teen in a dark windbreaker (Sen) offers a thumbs-up. Warm morning light, banners with the kanji 影.",
        texts: [
          { kind: "caption", ja: "東京から海峡を渡り、釜山、そしてソウルへ。ジュンの空の下。", romaji: "Toukyou kara kaikyou o watari, Busan, soshite Souru e. Jun no sora no shita.", en: "From Tokyo across the strait — Busan, then Seoul, under Jun's sky." },
          { kind: "speech", speaker: "Minjae", ja: "最下位のハンターですけど…覚えた言葉は、一語も忘れてません！", romaji: "Saikai no hantaa desu kedo… oboeta kotoba wa, ichigo mo wasuretemasen!", en: "I'm the lowest-ranked hunter there is… but I've never forgotten a single word I learned!" },
        ],
      },
      {
        id: "ch3_p2",
        aspect: "spread",
        beat: "The Loanword under sail out of Incheon, canvas patched with dictionary pages; Cora recruits the party aboard; Flan claims the galley; course west, because port-names are dying along the sea-roads.",
        cast: ["vo_nami", "ch_pud", "vo_luka"],
        artPrompt:
          "Full-color manga spread: a glorious rag-tag sailing ship (the Loanword) heeling out of Incheon harbor at golden hour, its patched sails made of giant dictionary pages in a dozen scripts. At the rail a freckled Irish star-reader with a net woven of starlight (Cora) hauls the party's gear aboard; a broad Samoan navigator in a woven sun-hat (Tavita) laughs at the wheel; a tiny custard-blob chef in a toque (Flan) plants a wooden spoon on the galley hatch like a flag. Gulls, spray, adventure.",
        texts: [
          { kind: "speech", speaker: "Cora", ja: "西の港が名前を失くしてる。海図が要るだろ？　うちのは糸で編むのさ。", romaji: "Nishi no minato ga namae o nakushiteru. Kaizu ga iru daro? Uchi no wa ito de amu no sa.", en: "The western ports are losing their names. You'll need charts — ours are woven, not drawn." },
          { kind: "speech", speaker: "Flan", ja: "厨房はもらった！　甘いものは士気！　士気は武器！", romaji: "Chuubou wa moratta! Amai mono wa shiki! Shiki wa buki!", en: "The galley is MINE! Sweetness is morale! Morale is a weapon!" },
        ],
      },
      {
        id: "ch3_p3",
        aspect: "portrait",
        beat: "Through the South China Sea toward Malacca: a stretch of ocean with no names left. Noor walks a moonlight road across black water to scout; Cora's woven chart unravels in real time.",
        cast: ["lu_tsukina", "vo_nami"],
        artPrompt:
          "Full-color manga panel: black, glass-still night ocean. An Egyptian moon-sister in indigo robes with a silver crescent circlet (Noor) walks calmly on a shining road of moonlight laid across the water, Khonsu's crescent hanging low as the road's source. Behind, on the ship's deck, a freckled Irish star-reader (Cora) holds a chart woven of colored threads — one whole region of it is unraveling, threads going grey and slack in her hands.",
        texts: [
          { kind: "speech", speaker: "Noor", ja: "月の神は月光を賭けて暦を買った。時間さえ交渉できる——道もね。", romaji: "Tsuki no kami wa gekkou o kakete koyomi o katta. Jikan sae koushou dekiru—— michi mo ne.", en: "Khonsu gambled moonlight and bought the calendar extra days. Even time is negotiable — so is a road." },
          { kind: "speech", speaker: "Cora", ja: "マラッカの糸が解けていく…名前ごと、海が消えていくんだ。", romaji: "Marakka no ito ga hodokete iku… namae goto, umi ga kiete iku n da.", en: "The Malacca threads are coming undone… the sea is vanishing, name by name." },
        ],
      },
      {
        id: "ch3_p4",
        aspect: "landscape",
        beat: "Isabela's defining act: far from her Amazon home, she sings Iara's song in reverse over a hollowed fishing village on the strait — and the villagers' memories of the sea flood back.",
        cast: ["sp_umi"],
        artPrompt:
          "Full-color manga panel: a stilt-house fishing village on a tropical strait at dusk, villagers standing grey and vacant on their docks. In the bow of a ship's boat, a Brazilian river girl with a shell necklace and blue tide-mark tattoos (Isabela) sings with her whole chest, eyes shut; her visible song flows out as a ribbon of river-water and fish and returning color that washes over the village, re-inking sails, nets, and painted boat-names. The kanji 海 glows on a boat's hull as it refills.",
        texts: [
          { kind: "speech", speaker: "Isabela", ja: "イアラの歌は忘れさせる歌。逆から歌えば——思い出す歌。", romaji: "Iara no uta wa wasuresaseru uta. Gyaku kara utaeba—— omoidasu uta.", en: "Iara's song makes men forget. Sung backwards — it makes them remember." },
          { kind: "caption", ja: "村人たちは泣きながら、自分の舟の名を呼んだ。", romaji: "Murabito-tachi wa nakinagara, jibun no fune no na o yonda.", en: "Weeping, the villagers called their boats by name." },
        ],
      },
      {
        id: "ch3_p5",
        aspect: "portrait",
        beat: "First Court appearance: the Censor boards mid-ocean, courteous and devastating, offering mercy — forget the war, keep your names. Refused. A crewman accepts.",
        cast: ["nc_kesu"],
        artPrompt:
          "Full-color manga panel: night deck of the dictionary-sailed ship in mid-ocean. A tall, gaunt scribe in layered robes stitched from the uniforms of a dozen dead empires, ink-black eyes, holding a long brush like a staff (the Censor), stands unnaturally still on the rail as if the sea holds its breath. The crew faces him with lanterns; one young crewman at the edge has already half-turned toward the Censor, his lantern dimming grey. Cold courtesy, dread.",
        texts: [
          { kind: "speech", speaker: "The Censor", ja: "「すべてを記憶する世界は、何も赦さない。」——降りなさい。名前は残してあげよう。", romaji: "\"Subete o kioku suru sekai wa, nani mo yurusanai.\" —— Orinasai. Namae wa nokoshite ageyou.", en: "'A world that remembers everything forgives nothing.' Step off this war, and you may keep your names." },
          { kind: "speech", speaker: "Devika", ja: "断る。それはレーテーの水だ——一口で楽になり、すべてを失う。引用しかできない口が、慈悲を語るな。", romaji: "Kotowaru. Sore wa Reetee no mizu da—— hitokuchi de raku ni nari, subete o ushinau. In'you shika dekinai kuchi ga, jihi o kataru na.", en: "Refused. That cup is Lethe's water — one sip of ease, and everything lost. A mouth that can only quote will not speak to us of mercy." },
        ],
      },
      {
        id: "ch3_p6",
        aspect: "spread",
        beat: "HEARTBREAK — the crewman fades mid-laugh, his speech bubble finishing without him; Flan's pudding sits untouched at his place. Course held west for the Indian Ocean; Minjae writes the man's name in his notebook so at least one page remembers.",
        cast: ["sh_rookie", "ch_pud"],
        artPrompt:
          "Full-color manga spread: the ship's lamplit mess table at night. At one seat a young crewman is dissolving into drifting grey letters mid-laugh, his half-raised mug frozen; his crewmates lunge across the table too late. In the foreground an untouched golden pudding sits at his place setting, and a Korean rookie hunter (Minjae) grips a pencil, writing furiously in a battered notebook, tears on the page. A tiny custard-blob chef (Flan) removes its toque, held to its chest. Grief, lamplight, sea-dark portholes.",
        texts: [
          { kind: "speech", speaker: "Crewman", ja: "だってよ、あの島の酒はほんとに——", romaji: "Datte yo, ano shima no sake wa honto ni——", en: "I'm telling you, the rum on that island was really—" },
          { kind: "speech", speaker: "Minjae", ja: "ホジュン。チェ・ホジュン。おれのノートは、忘れない。", romaji: "Hojun. Che Hojun. Ore no nooto wa, wasurenai.", en: "Ho-jun. Choi Ho-jun. My notebook doesn't forget." },
          { kind: "caption", ja: "レーテーの川に対して、ギリシャ人は記憶の女神を立てた——ムネーモシュネー。この夜、一冊の安ノートがその祭壇になった。", romaji: "Reetee no kawa ni taishite, Girishajin wa kioku no megami o tateta—— Muneemoshunee. Kono yoru, issatsu no yasu-nooto ga sono saidan ni natta.", en: "Against the river Lethe, the Greeks set a goddess: Mnemosyne, Memory, mother of every Muse. That night her altar was a cheap school notebook." },
        ],
      },
    ],
  },
  {
    n: 4,
    id: "ch4",
    titleEn: "The Word for Home",
    titleJa: "家という言葉",
    titleRomaji: "Ie to Iu Kotoba",
    gateLevel: 15,
    setting: "Suez and Cairo — the Kestrel House safehouse-in-exile at the gate of two seas",
    debutCardIds: ["he_loid", "ps_dimple", "sl_mizuho", "po_flame", "ti_hana", "re_yuki"],
    kanji: ["父", "霊", "水", "火", "翼", "氷"],
    panels: [
      {
        id: "ch4_p1",
        aspect: "landscape",
        beat: "TRAVEL — across the Indian Ocean and up the Red Sea into the Suez Canal; Émile waits at the dock of his relocated safehouse, apron on, pistol under it, kitchen warm behind him.",
        cast: ["he_loid", "he_anya"],
        artPrompt:
          "Full-color manga panel: the dictionary-sailed ship gliding into the Suez Canal at evening, desert gold on one side, city lights on the other. On a private dock stands a sharp-featured Frenchman in an immaculate apron over a shoulder holster (Émile), lifting a lantern; behind him a warm-lit townhouse kitchen door stands open. A tiny German girl in an oversized coat (Pip) waves wildly from the bowsprit.",
        texts: [
          { kind: "caption", ja: "インド洋を渡り、紅海を北へ。二つの海の門・スエズに、灯の家は先回りしていた。", romaji: "Indoyou o watari, Koukai o kita e. Futatsu no umi no mon Suezu ni, Hi no Ie wa sakimawari shite ita.", en: "Across the Indian Ocean, north up the Red Sea. At Suez, gate of two seas, the Kestrel House had moved ahead of the war." },
          { kind: "speech", speaker: "Pip", ja: "パパーー！！", romaji: "Papaaa!!", en: "PAPAAA!!" },
          { kind: "speech", speaker: "Émile", ja: "おかえり。スープは熱い。銃は冷えてる。両方うちの家風だ。", romaji: "Okaeri. Suupu wa atsui. Juu wa hieteru. Ryouhou uchi no kafuu da.", en: "Welcome home. The soup is hot, the guns are cold. Both are house tradition." },
        ],
      },
      {
        id: "ch4_p2",
        aspect: "portrait",
        beat: "Refugees who've lost the word for 'home' shelter at Émile's table; Pip hears their meaning intact underneath — meaning survives its word (the keystone). Blip photobombs the tragedy and somehow helps.",
        cast: ["he_anya", "ps_dimple", "he_loid"],
        artPrompt:
          "Full-color manga panel: a long candlelit kitchen table crowded with refugee families of many nations, warm food before them; above their heads their speech renders as faded, hollow outlines. A tiny German girl in an oversized coat (Pip) stands on a chair with her eyes closed and hands to her temples — and beneath the table-scene, like an underpainting bleeding through, the same families glow in full color. A smug grinning purple spirit blob (Blip) balances a bread roll on its head to make a child laugh. A Frenchman in an apron (Émile) ladles soup.",
        texts: [
          { kind: "speech", speaker: "Pip", ja: "ことばは消えても、意味は生きてる。この人たちの「ただいま」、まだ言える。", romaji: "Kotoba wa kiete mo, imi wa ikiteru. Kono hito-tachi no \"tadaima\", mada ieru.", en: "The words are gone, but the meaning's alive. Their 'I'm home' can still be said." },
          { kind: "speech", speaker: "Blip", ja: "迷惑って言葉で覚えられてる霊です！　覚えられたもん勝ち！", romaji: "Meiwaku tte kotoba de oboerareteru rei desu! Oboerareta mon gachi!", en: "I'm the spirit remembered as 'nuisance'! Remembered is remembered — I win!" },
        ],
      },
      {
        id: "ch4_p3",
        aspect: "landscape",
        beat: "Zola glides in off the desert with her survey charts: a man-shaped hole in the Lattice over Tibet. She jokes because she has seen exactly how much of the map has gone dark.",
        cast: ["ti_hana"],
        artPrompt:
          "Full-color manga panel: a South African wing-scout (Zola) banking in over Suez rooftops at sunset on glider-wings painted with the Zulu lightning-bird, sand streaming off them, landing at a run on the safehouse terrace. She slaps a huge aerial chart onto the table: a web of glowing threads over Asia with one hole in it precisely the silhouette of a seated man. The kanji 翼 painted on her wingtip.",
        texts: [
          { kind: "speech", speaker: "Zola", ja: "上から見るとね、世界は歯抜けのセーターよ。笑うしかないでしょ？", romaji: "Ue kara miru to ne, sekai wa hanuke no seetaa yo. Warau shika nai desho?", en: "From above, the world's a sweater full of holes. What can you do but laugh?" },
          { kind: "speech", speaker: "Zola", ja: "で、これ。チベットの湖のほとりに、人の形の「穴」。誰か、忘れられかけてる。", romaji: "De, kore. Chibetto no mizuumi no hotori ni, hito no katachi no \"ana\". Dareka, wasurerarekaketeru.", en: "And — this. By a lake in Tibet: a hole shaped like a man. Someone is almost forgotten." },
        ],
      },
      {
        id: "ch4_p4",
        aspect: "portrait",
        beat: "Tenzin arrives along the last thread that remembers him — one old ferryman's memory — flickering, half-transparent, carrying a bowl of Yamdrok lake-water. Devika catches him; fire steadies water.",
        cast: ["sl_mizuho", "sl_honoka"],
        artPrompt:
          "Full-color manga panel: the safehouse courtyard at night. Out of a single thin, guttering thread of light steps a young Tibetan monk in ochre robes (Tenzin), his body flickering half-transparent like a candle in wind, cradling a brass bowl of luminous turquoise lake-water without spilling a drop. A young Indian woman in a saffron-and-charcoal haori (Devika) catches his elbow; where her ember-glow touches him, his outline steadies. The kanji 水 reflected in the bowl.",
        texts: [
          { kind: "speech", speaker: "Tenzin", ja: "湖の名を、毎朝呼び続けました。私の名を呼ぶ人は…渡し守が、一人だけ。", romaji: "Mizuumi no na o, maiasa yobitsuzukemashita. Watashi no na o yobu hito wa… watashimori ga, hitori dake.", en: "Every morning I kept calling the lake's name. As for my name… one old ferryman still calls it." },
          { kind: "speech", speaker: "Devika", ja: "今夜からは六十人が呼ぶ。テンジン。もう flicker するな。", romaji: "Kon'ya kara wa rokujuunin ga yobu. Tenjin. Mou kiekakaru na.", en: "From tonight, sixty of us will call it. Tenzin. No more flickering." },
        ],
      },
      {
        id: "ch4_p5",
        aspect: "portrait",
        beat: "Sunmi arrives escorting a dying grandmother's last word, frozen mid-air like a paper crane of ice, holding it unfaded until the woman's emigrant grandson reaches Suez to receive it.",
        cast: ["re_yuki"],
        artPrompt:
          "Full-color manga panel: a dim, warm sickroom in the safehouse. A Korean courier in a white winter hanbok, frost on her breath (Sunmi), kneels with both hands cupped around a small word frozen in mid-air — a crystalline shape like an ice paper-crane, glowing faintly. Across the bed, a young man in travel clothes, luggage still on his shoulder, reaches out with shaking hands. An old woman sleeps peacefully. The kanji 氷 glitters in the frost on the window.",
        texts: [
          { kind: "speech", speaker: "Sunmi", ja: "三千キロ、凍らせたまま運んだ。おばあさまの最後のひと言。受け取って。", romaji: "Sanzen-kiro, kooraseta mama hakonda. Obaa-sama no saigo no hitokoto. Uketotte.", en: "Three thousand kilometers, frozen unfaded. Your grandmother's last word. Receive it." },
          { kind: "speech", speaker: "Grandson", ja: "……「よく帰ったね」だ。ばあちゃん、おれ、帰ったよ。", romaji: "……\"Yoku kaetta ne\" da. Baa-chan, ore, kaetta yo.", en: "…It says 'welcome home.' Grandma — I'm home." },
        ],
      },
      {
        id: "ch4_p6",
        aspect: "landscape",
        beat: "Emberkit takes a coal from Devika's Manikarnika flame into its mouth: the first fire goes mobile. Tenzin blesses the ship's water casks with Yamdrok water — fire and water both board the Loanword; next port of call, the coast where letters were born.",
        cast: ["po_flame", "sl_mizuho", "sl_honoka"],
        artPrompt:
          "Full-color manga panel: the ship's deck at dawn, ready to sail north. A tiny fire-fox kit (Emberkit) solemnly receives a live orange coal into its mouth from a young Indian woman in a saffron-and-charcoal haori (Devika), its tail curled like a windbreak. Beside them a young Tibetan monk (Tenzin) pours luminous turquoise water into the ship's water casks, each cask-lid marked 水. Canal light, morning gulls, the Levant northward.",
        texts: [
          { kind: "speech", speaker: "Devika", ja: "千年消えなかった火だ。小さき者、頼んだぞ。", romaji: "Sennen kienakatta hi da. Chiisaki mono, tanonda zo.", en: "A fire that has not gone out in a thousand years. Little one — it's yours to carry." },
          { kind: "speech", speaker: "Tenzin", ja: "火の隣に水を。祈りは対で強くなる。……次は、文字が生まれた海岸ですね。", romaji: "Hi no tonari ni mizu o. Inori wa tsui de tsuyoku naru. ……Tsugi wa, moji ga umareta kaigan desu ne.", en: "Water beside fire — rites are stronger in pairs. …Next: the coast where letters were born." },
        ],
      },
    ],
  },
  {
    n: 5,
    id: "ch5",
    titleEn: "Birthplace of Letters",
    titleJa: "文字のふるさと",
    titleRomaji: "Moji no Furusato",
    gateLevel: 20,
    setting: "Byblos, Lebanon — north up the Levant coast from Suez, to the alphabet's cradle",
    debutCardIds: ["cu_maki", "ne_rebel", "me_asuka", "ho_mitsu", "sh_ranger"],
    kanji: ["刃", "夜", "紅", "糸", "弓"],
    panels: [
      {
        id: "ch5_p1",
        aspect: "landscape",
        beat: "TRAVEL — the Loanword beats north along the Levant coast; Rania flies out from Byblos to meet the ship, crimson contrail over her burning hometown ruins.",
        cast: ["me_asuka"],
        artPrompt:
          "Full-color manga panel: the dictionary-sailed ship running north along a rocky Mediterranean coast at dusk. Overhead, a Lebanese pilot in a crimson flight jacket (Rania) drops low in a sleek flyer trailing a Tyrian-crimson contrail, matching the ship's speed, canopy open, pointing back toward a headland town where ancient ruins glow with an unnatural grey shimmer. Spray, urgency, red dusk. The kanji 紅 on her tail-fin.",
        texts: [
          { kind: "caption", ja: "スエズから北へ、レバントの海岸沿い。ビブロス——「本」という言葉の生まれ故郷。", romaji: "Suezu kara kita e, Rebanto no kaiganzoi. Biburosu—— \"hon\" to iu kotoba no umarekokyou.", en: "North from Suez along the Levant coast. Byblos — the town that gave 'book' its name." },
          { kind: "speech", speaker: "Rania", ja: "検閲官が来た。文字の根っこを消しに。——うちの町でやらせるか！", romaji: "Ken'etsukan ga kita. Moji no nekko o keshi ni. —— Uchi no machi de yaraseru ka!", en: "The Censor's here — to erase the root of letters. Not in MY town!" },
        ],
      },
      {
        id: "ch5_p2",
        aspect: "spread",
        beat: "Byblos ruins at dusk: the 22 Phoenician letters glow on old stones like embers under ash — and the Censor's construct rises, stitched entirely from quotations of burned libraries.",
        cast: ["nc_kesu"],
        artPrompt:
          "Full-color manga spread: the ancient ruins of Byblos above the sea at dusk, twenty-two Phoenician letters glowing like embers on weathered stones. Rising over the excavation, a towering construct woven from ribbons of legible stolen text in dozens of scripts — every line a quotation — its head a blank page. Behind it, small and calm on a column, the gaunt many-empires scribe with ink-black eyes (the Censor). The party's silhouettes brace below.",
        texts: [
          { kind: "speech", speaker: "The Censor", ja: "《アレクサンドリアは燃えた》《焚書坑儒》《禁書目録》——ほら、全部あなたたちの言葉だ。", romaji: "《Arekusandoria wa moeta》《funsho koujuu》《kinsho mokuroku》—— hora, zenbu anata-tachi no kotoba da.", en: "'Alexandria burned.' 'Burn the books, bury the scholars.' 'The Index of Forbidden Books.' — You see: all your own words." },
          { kind: "caption", ja: "静寂の僕は、引用しか話せない。", romaji: "Shijima no shimobe wa, in'you shika hanasenai.", en: "The Hush's servants can speak only in quotation." },
        ],
      },
      {
        id: "ch5_p3",
        aspect: "portrait",
        beat: "The combo is born: Idris pronounces the construct's true description, stutter and all — and Priya's cursed blade, which cuts only what has been correctly named, shears it through. The name burns along her edge.",
        cast: ["cu_maki", "cu_rei"],
        artPrompt:
          "Full-color manga panel, dynamic action: a Kolkata bladewoman with ten bangles blazing (Priya) mid-leap, her dark khanda blade cutting clean through a giant construct of woven quotations — along the blade's edge a sentence of golden script burns like a fuse. Below, a hooded Nigerian teen with chalk-marked knuckles (Idris) stands his ground, mouth open mid-word, chalk-light sentences orbiting him. Shredded ribbons of stolen text rain down. The kanji 刃 flashes on the blade's guard.",
        texts: [
          { kind: "speech", speaker: "Idris", ja: "お、お前は——「盗んだ声で紙を焼く、火事の記憶」だ！", romaji: "O, omae wa—— \"nusunda koe de kami o yaku, kaji no kioku\" da!", en: "Y-you are — 'the memory of a fire that burns pages with stolen voices'!" },
          { kind: "speech", speaker: "Priya", ja: "名指しご苦労！　じゃ、遠慮なく——斬るっ！", romaji: "Nazashi gokurou! Ja, enryo naku—— kirutt!", en: "Named and shamed! Then if you don't mind — I'll CUT!" },
          { kind: "sfx", ja: "ザンッ", romaji: "zantt", en: "SHRAK" },
        ],
      },
      {
        id: "ch5_p4",
        aspect: "portrait",
        beat: "Aditi draws on the Censor himself — and lowers her bow: she cannot yet name what he is, and she refuses to loose at anything she can't name. The discipline the finale will need.",
        cast: ["sh_ranger"],
        artPrompt:
          "Full-color manga panel: on a broken Byblos rampart, an Indian ranger (Aditi) at full draw, a great bow bent, arrow-tip glowing with a half-formed word — aimed at the distant gaunt scribe. Her eye is perfectly steady, seeing only him, everything else soft-blurred like the Gandiva test. Then: the string eased, the arrow lowered, her jaw set. Wind in the dusk grass. The kanji 弓 tooled into the bow's grip.",
        texts: [
          { kind: "thought", speaker: "Aditi", ja: "的の目しか見えない。……でも、あれの「名」がまだ見えない。", romaji: "Mato no me shika mienai. ……Demo, are no \"na\" ga mada mienai.", en: "I see only the target's eye. …But I cannot yet see its name." },
          { kind: "speech", speaker: "Aditi", ja: "名指せないものは、射たない。それが私の弓だ。", romaji: "Nazasenai mono wa, itanai. Sore ga watashi no yumi da.", en: "What I cannot name, I do not shoot. That is my bow." },
        ],
      },
      {
        id: "ch5_p5",
        aspect: "landscape",
        beat: "Ingrid splices the severed Byblos strand with Norn-thread — and pays: for one day she feels every goodbye ever said along it. Tenzin's blessed water cools the splice; fire-rite meets water-rite meets thread.",
        cast: ["ho_mitsu", "sl_mizuho"],
        artPrompt:
          "Full-color manga panel: night over the Byblos ruins. A Swedish thread-keeper with a spindle (Ingrid) kneels where a great strand of light lies cut like a severed hawser; she splices it with glowing red thread from her spindle, her face streaked with tears that are not hers, ghostly farewell scenes flickering along the repaired strand. A young Tibetan monk (Tenzin) pours luminous turquoise water over the splice, steam rising as it seals. The kanji 糸 in her thread.",
        texts: [
          { kind: "speech", speaker: "Ingrid", ja: "ノルンの弟子と呼ばれてる。証明はできない。それが好き。……っ、来る。三千年ぶんの「さよなら」。", romaji: "Norun no deshi to yobareteru. Shoumei wa dekinai. Sore ga suki. ……tt, kuru. Sanzen-nen bun no \"sayonara\".", en: "They say I trained under the Norns. Can't prove it. I love that. …Here it comes — three thousand years of goodbyes." },
          { kind: "speech", speaker: "Tenzin", ja: "湖の水は別れも祝福する。一人で泣かなくていい。", romaji: "Mizuumi no mizu wa wakare mo shukufuku suru. Hitori de nakanakute ii.", en: "Lake-water blesses partings too. You don't have to weep them alone." },
        ],
      },
      {
        id: "ch5_p6",
        aspect: "portrait",
        beat: "Anya — who once stole her own name back from a Hush ledger — recognizes the Censor's ledger-script and steals a page: 'the Archivist,' and a timetable keyed to a comet. The trail points north, up the coast to the city of a thousand tongues.",
        cast: ["ne_rebel"],
        artPrompt:
          "Full-color manga panel: a moonlit rooftop in Byblos town. A pale Russian night-runner in a dark hood (Anya) crouches on a parapet holding a stolen ledger page that glows with cold grey script; visible on the page, one childhood entry struck through — her own. Her expression: someone reading the handwriting of an old nightmare. Below, the harbor; north along the coast, city-glow on the horizon. The kanji 夜 in the page's watermark.",
        texts: [
          { kind: "speech", speaker: "Anya", ja: "この帳簿の字…あたしの名前を消しかけた字だ。忘れるもんか。", romaji: "Kono choubo no ji… atashi no namae o keshikaketa ji da. Wasureru mon ka.", en: "This ledger-hand… the same hand that almost erased my name. As if I'd ever forget it." },
          { kind: "speech", speaker: "Anya", ja: "「書庫番」——それと、彗星の時刻表。敵さん、予定があるらしい。", romaji: "\"Shokoban\" —— sore to, suisei no jikokuhyou. Teki-san, yotei ga aru rashii.", en: "'The Archivist' — and a timetable keyed to a comet. Seems the enemy keeps a schedule." },
        ],
      },
    ],
  },
  {
    n: 6,
    id: "ch6",
    titleEn: "Steam and Respite",
    titleJa: "湯気のやすらぎ",
    titleRomaji: "Yuge no Yasuragi",
    gateLevel: 25,
    setting: "Istanbul — north through the Aegean to Grandfather Ash's hamam near Çemberlitaş",
    debutCardIds: ["ch_knight", "sp_kama", "vo_zoro", "lu_venus", "he_yor", "nc_echo"],
    kanji: ["勇", "湯", "刀", "愛", "刺", "響"],
    panels: [
      {
        id: "ch6_p1",
        aspect: "landscape",
        beat: "TRAVEL — up the Aegean and through the Bosphorus at dawn; Leyla meets the ship at the old city dock: she has run a safehouse in a bathhouse here for a decade. Bao stands at the rail with a sword that isn't his.",
        cast: ["he_yor", "vo_zoro"],
        artPrompt:
          "Full-color manga panel: the dictionary-sailed ship gliding up the Bosphorus at dawn, Istanbul's domes and minarets in rose light, ferries crossing. On the stone quay waits a poised Turkish woman in an embroidered shawl, market basket on her arm with needle-hilts glinting under the bread (Leyla). At the ship's rail a Vietnamese swordsman (Bao) holds a jian in a turtle-shell scabbard with the careful grip of a borrowed thing. The kanji 湯 on a bathhouse sign uphill.",
        texts: [
          { kind: "caption", ja: "エーゲ海を北へ、ボスポラスへ。十二の帝国の言葉が眠る街。", romaji: "Eegekai o kita e, Bosuporasu e. Juuni no teikoku no kotoba ga nemuru machi.", en: "North through the Aegean, into the Bosphorus — a city where twelve empires' words lie sleeping." },
          { kind: "speech", speaker: "Leyla", ja: "十年この街で「主婦」をやってるの。針は料理にも諜報にも使えるわ。お風呂、沸いてるわよ。", romaji: "Juunen kono machi de \"shufu\" o yatteru no. Hari wa ryouri ni mo chouhou ni mo tsukaeru wa. Ofuro, waiteru wa yo.", en: "Ten years a 'housewife' in this town. A needle works for dinner or for spycraft. The bath is drawn." },
          { kind: "speech", speaker: "Bao", ja: "この刀は借り物だ。戦が終われば、亀の神様に返す。", romaji: "Kono katana wa karimono da. Ikusa ga owareba, kame no kamisama ni kaesu.", en: "This sword is borrowed. When the war ends, it goes back to the Turtle God." },
        ],
      },
      {
        id: "ch6_p2",
        aspect: "spread",
        beat: "The whole party in Grandfather Ash's steam, weapons checked at the door in a ridiculous tender pile; the old djinn of the hamam pours water over hot stone and every tongue loosens.",
        cast: ["sp_kama"],
        artPrompt:
          "Full-color manga spread: the marble heart of an old Istanbul hamam, shafts of light through star-pierced domes, everyone wrapped in peştemal towels, laughing, arguing, dozing on the hot stone — the whole rag-tag party together. By the door, an absurd tender pile: cleaver, bow, needles, glider-wings, a jian, a wooden spoon. Rising from the central basin, an old djinn whose body is warm steam wearing a towel-turban (Grandfather Ash) pours water over hot stone. The kanji 湯 in the rising steam.",
        texts: [
          { kind: "speech", speaker: "Grandfather Ash", ja: "この湯には十二の帝国の言葉が溶けとる。ゆっくり浸かれ。舌がほどけるぞ。", romaji: "Kono yu ni wa juuni no teikoku no kotoba ga toketoru. Yukkuri tsukare. Shita ga hodokeru zo.", en: "Twelve empires' words are dissolved in this water. Soak slowly — it loosens tongues." },
          { kind: "speech", speaker: "Renji", ja: "……悪くねえ。戦の真ん中で風呂って発想が、もう勝ってる。", romaji: "……Warukunee. Ikusa no mannaka de furo tte hassou ga, mou katteru.", en: "…Not bad. A bath in the middle of a war — the idea alone is already a victory." },
        ],
      },
      {
        id: "ch6_p3",
        aspect: "portrait",
        beat: "Camila's Guatavita doctrine, taught in the steam: the conquistadors heard 'gold' where the Muisca meant 'offering' — mistranslation is the Hush's oldest ally; love is translating people correctly.",
        cast: ["lu_venus"],
        artPrompt:
          "Full-color manga panel: in lamplit steam, a Colombian love-keeper with a small gold offering-pendant (Camila) sits cross-legged telling a story, and the steam above her shapes it: a highland lake, a raft, gold offerings sinking — then armored men whose greedy eyes turn the same image into coins. Young party members listen rapt around her. Warm gold and teal light. The kanji 愛 glowing softly in her pendant.",
        texts: [
          { kind: "speech", speaker: "Camila", ja: "彼らは「黄金」と聞いた。私たちは「捧げ物」と言ったのに。誤訳は静寂の一番古い味方よ。", romaji: "Karera wa \"ougon\" to kiita. Watashi-tachi wa \"sasagemono\" to itta noni. Goyaku wa Shijima no ichiban furui mikata yo.", en: "They heard 'gold.' We had said 'offering.' Mistranslation is the Hush's oldest ally." },
          { kind: "speech", speaker: "Camila", ja: "愛はね、人を正しく翻訳し続ける努力のこと。", romaji: "Ai wa ne, hito o tadashiku hon'yaku shitsuzukeru doryoku no koto.", en: "And love? Love is the discipline of translating a person correctly, again and again." },
        ],
      },
      {
        id: "ch6_p4",
        aspect: "portrait",
        beat: "COMEDY — Sir Pebble is knighted with a biscuit-sword, everyone perfectly solemn; he immediately takes up guard duty at a door three hundred times his size.",
        cast: ["ch_knight", "ch_mocha"],
        artPrompt:
          "Full-color manga panel: the hamam's cool-room. A tiny cardboard knight (Sir Pebble) kneels on an upturned soap dish while a solemn circle of towel-wrapped warriors watches; a biscuit is laid on his shoulder like a sword. A round snack gremlin (Mochi) weeps openly into a tiny handkerchief, visibly also wanting to eat the biscuit. Candle-light, held laughter, genuine ceremony. The kanji 勇 embroidered on a towel banner.",
        texts: [
          { kind: "speech", speaker: "Sir Pebble", ja: "勇気とは、恐れぬことにあらず。恐れを正しく発音することなり！", romaji: "Yuuki to wa, osorenu koto ni arazu. Osore o tadashiku hatsuon suru koto nari!", en: "Courage is not the absence of fear! It is fear, correctly pronounced!" },
          { kind: "speech", speaker: "Mochi", ja: "りっぱ…りっぱだけど…ビスケットが…もったいない……", romaji: "Rippa… rippa da kedo… bisuketto ga… mottainai……", en: "So noble… so noble… but the biscuit… such a waste…" },
        ],
      },
      {
        id: "ch6_p5",
        aspect: "landscape",
        beat: "The theft: keepers wake missing words — stolen, not erased. Echo stands in the cooling-room doorway, stolen words orbiting him like moths; Pip hears what's underneath the theft: pure terror of his language dying.",
        cast: ["nc_echo", "he_anya"],
        artPrompt:
          "Full-color manga panel: the hamam cooling-room at midnight, keepers sitting up on their couches clutching their throats. In the arched doorway, backlit, a silver-haired Icelandic boy in a worn wool coat (Kael 'Echo'), a slow orbit of small glowing stolen words circling him like moths; his face is defiant and utterly frightened at once. A tiny German girl in an oversized coat (Pip) points at him — not accusing; heartbroken.",
        texts: [
          { kind: "speech", speaker: "Echo", ja: "盗んだんじゃない、保存したんだ！　アイスランド語が死ぬ世代に、俺はならない！", romaji: "Nusunda n ja nai, hozon shita n da! Aisurando-go ga shinu sedai ni, ore wa naranai!", en: "I didn't steal them — I SAVED them! I won't be the generation that lets Icelandic die!" },
          { kind: "speech", speaker: "Pip", ja: "うそ。この人の中、悲鳴でいっぱい。……こわいよう、って。", romaji: "Uso. Kono hito no naka, himei de ippai. ……Kowai you, tte.", en: "That's not it. Inside, he's all screaming. It just says… 'I'm scared.'" },
        ],
      },
      {
        id: "ch6_p6",
        aspect: "portrait",
        beat: "Echo escapes over the rooftops; Grandfather Ash quietly confirms he remembers 'the Archivist' — Halime, who used to bathe here — the steam forming, faintly, a reading woman. Two trails now: the Archivist, and bells to the south crying for help.",
        cast: ["sp_kama"],
        artPrompt:
          "Full-color manga panel: the hamam's dome at night, a skylight hatch swinging where the silver-haired thief fled across moonlit rooftops. Below, the old steam-djinn (Grandfather Ash) gazes into the rising vapor, which faintly forms the figure of a seated woman reading a book. His expression: eighty years of fondness. Through a window, far southern sky — and the ghost of a bell-sound drawn as thin golden rings on the horizon. The kanji 響 in the fading rings.",
        texts: [
          { kind: "speech", speaker: "Grandfather Ash", ja: "「書庫番」……ハリメじゃよ。毎週土曜、湯に本を持ち込む困った客での。わしはまだ、覚えとる。", romaji: "\"Shokoban\" ……Harime ja yo. Maishuu doyou, yu ni hon o mochikomu komatta kyaku de no. Washi wa mada, oboetoru.", en: "'The Archivist'… that's Halime. My worst customer — books in the bath, every Saturday. I remember her still." },
          { kind: "caption", ja: "その夜、南の空から、鐘の音が助けを呼んだ。", romaji: "Sono yoru, minami no sora kara, kane no ne ga tasuke o yonda.", en: "And that night, from the southern sky, the sound of bells called for help." },
        ],
      },
    ],
  },
  {
    n: 7,
    id: "ch7",
    titleEn: "The Con Man's True Word",
    titleJa: "嘘つきの真言",
    titleRomaji: "Usotsuki no Shingon",
    gateLevel: 30,
    setting: "Lalibela, Ethiopia — south through Suez and the Red Sea to the rock-hewn churches",
    debutCardIds: ["ps_reigen", "po_aqua", "sl_kagura"],
    kanji: ["師", "波", "鈴"],
    panels: [
      {
        id: "ch7_p1",
        aspect: "landscape",
        beat: "TRAVEL — back through Suez (the canal pilots know Flan by name now) and down the Red Sea; from the coast, mule-trail up into the Ethiopian highlands, following the failing sound of Amara's bells.",
        cast: ["ch_pud", "cu_rei"],
        artPrompt:
          "Full-color manga panel, two-part travel montage in one scene: background, the dictionary-sailed ship running south down the Red Sea past desert coasts; foreground, the party on a mule trail switchbacking up green Ethiopian highlands at dawn, thin golden bell-rings rippling weakly across the sky from beyond the ridge. A hooded Nigerian teen (Idris) walks grim and fast ahead of everyone. A tiny custard-blob chef (Flan) waves back toward the canal from atop a mule.",
        texts: [
          { kind: "caption", ja: "スエズ再び——運河の水先案内人はもうフランの常連だ。紅海を南へ、高地を上へ。鐘の音が、弱っていく。", romaji: "Suezu futatabi—— unga no mizusaki annainin wa mou Furan no jouren da. Koukai o minami e, kouchi o ue e. Kane no ne ga, yowatte iku.", en: "Suez again — the canal pilots are Flan's regulars now. South down the Red Sea, up into the highlands. And the bells are growing weaker." },
          { kind: "speech", speaker: "Idris", ja: "ラゴスから「あの人」も糸で来る。……会いたくなかった。", romaji: "Ragosu kara \"ano hito\" mo ito de kuru. ……Aitakunakatta.", en: "'He' is coming too, by thread, from Lagos. …I did not want to see him." },
        ],
      },
      {
        id: "ch7_p2",
        aspect: "portrait",
        beat: "Baba Kunle lattice-walks in from Lagos, arriving in a shower of cowrie shells and showmanship — Idris's estranged uncle, the fraud who made him distrust words. Èṣù's shadow points four ways at once.",
        cast: ["ps_reigen", "cu_rei"],
        artPrompt:
          "Full-color manga panel: a highland crossroads at noon outside Lalibela. Out of a burst of golden thread-light steps a flamboyant Lagos showman in a cowrie-shell embroidered suit, arms wide (Baba Kunle), his shadow splitting four ways at once along the crossroad like Èṣù's. Facing him, a hooded Nigerian teen (Idris) with fists clenched, chalk dust rising off his knuckles. Highland light, tension and theater in equal parts. The kanji 師 on Kunle's lapel pin.",
        texts: [
          { kind: "speech", speaker: "Baba Kunle", ja: "甥っ子！　大きくなったなあ！　叔父さんの「営業」はまだ許してない顔だな？", romaji: "Oikko! Ookiku natta naa! Ojisan no \"eigyou\" wa mada yurushitenai kao da na?", en: "Nephew! Look how you've grown! And still wearing the 'I haven't forgiven your business model' face!" },
          { kind: "speech", speaker: "Idris", ja: "あんたの嘘が、ぼくに言葉を疑わせた。ど、どの面下げて「師」を名乗る。", romaji: "Anta no uso ga, boku ni kotoba o utagawaseta. Do, dono tsura sagete \"shi\" o nanoru.", en: "Your lies taught me to distrust words. H-how dare you wear the word 'mentor.'" },
        ],
      },
      {
        id: "ch7_p3",
        aspect: "spread",
        beat: "Bet Giyorgis from above, cross-shaped in living rock, Hush-fog pooling in the trench around it; Amara stands on the roof-cross ringing against the siege — the Hush isn't erasing the chants, it's making the chanters doubt they ever understood them.",
        cast: ["sl_kagura"],
        artPrompt:
          "Full-color manga spread, aerial view: the church of Bet Giyorgis at Lalibela seen from directly above — a perfect cross sunk in living rock — with grey fog pooling in the deep trench around it like rising water. On the roof-cross stands an Ethiopian bell-ringer in a white shamma robe (Amara), swinging a great bronze bell; golden sound-rings of interleaved Ge'ez letters and kanji ripple out and are eaten at the edges by fog. Tiny grey-faced chanters stand in the trench, hands slack around their prayer staffs.",
        texts: [
          { kind: "speech", speaker: "Amara", ja: "消してはいない——疑わせている！　「本当に意味を分かっていたのか」と、千年の聖歌に！", romaji: "Keshite wa inai—— utagawasete iru! \"Hontou ni imi o wakatte ita no ka\" to, sennen no seika ni!", en: "It isn't erasing them — it's making them DOUBT! 'Did you ever truly understand?' — to a thousand years of chant!" },
          { kind: "caption", ja: "静寂のいちばん残酷な武器は、疑いだった。", romaji: "Shijima no ichiban zankoku na buki wa, utagai datta.", en: "The Hush's cruelest weapon was doubt." },
        ],
      },
      {
        id: "ch7_p4",
        aspect: "portrait",
        beat: "Kunle, of all people, breaks the siege: a con man knows exactly how doubt is installed — so he uninstalls it, patter warm among the grey. The theological grenade: his kindly-meant lies are MEANT, and the Hush cannot feed on them.",
        cast: ["ps_reigen"],
        artPrompt:
          "Full-color manga panel: down in the fog-filled trench of Bet Giyorgis, a flamboyant Lagos showman in a cowrie-shell suit (Baba Kunle) works the line of grey-faced chanters like a crowd, hands flying, his speech visibly warm gold against the grey fog which recoils from every word. One elderly chanter's eyes refocus mid-panel, color flooding back into his robes. Idris watches from above, thunderstruck.",
        texts: [
          { kind: "speech", speaker: "Baba Kunle", ja: "じいさん、六十年歌って一度も意味を外したことがない——顔に書いてある！　わたしはプロだ、顔は読める！", romaji: "Jii-san, rokujuu-nen utatte ichido mo imi o hazushita koto ga nai—— kao ni kaite aru! Watashi wa puro da, kao wa yomeru!", en: "Old man — sixty years of singing and you never once missed the meaning. It's written on your face! I'm a professional. I READ faces!" },
          { kind: "speech", speaker: "Baba Kunle", ja: "詐欺師は疑いの入れ方を知っとる。だから——抜き方もな。", romaji: "Sagishi wa utagai no irekata o shittoru. Dakara—— nukikata mo na.", en: "A con man knows exactly how doubt is installed. Which means — he knows how to uninstall it." },
        ],
      },
      {
        id: "ch7_p5",
        aspect: "portrait",
        beat: "Idris and Kunle, after: the saga forgives its liar. A lie meant kindly is still meant — Rule 1 protects his patter, to his own theological horror. Uncle and nephew, reconciled at a crossroads.",
        cast: ["cu_rei", "ps_reigen"],
        artPrompt:
          "Full-color manga panel: dusk at Lalibela, the fog burning off gold. A hooded Nigerian teen (Idris) and a flamboyant showman in a cowrie suit (Baba Kunle) sit side by side on the trench edge, legs dangling over the church of living rock, sharing roasted grain from one paper cone. Neither looks at the other; both are almost smiling. Long shadows, bells faint and healthy in the distance.",
        texts: [
          { kind: "speech", speaker: "Idris", ja: "……あんたの嘘は、や、優しく「本気」だった。静寂はそれを食えない。理屈が、あんたを守ってた。", romaji: "……Anta no uso wa, ya, yasashiku \"honki\" datta. Shijima wa sore o kuenai. Rikutsu ga, anta o mamotteta.", en: "…Your lies were kindly m-meant. The Hush can't feed on them. The rules themselves were protecting you." },
          { kind: "speech", speaker: "Baba Kunle", ja: "やめてくれ、神学的に恐ろしい。……悪かったな、イドリス。", romaji: "Yamete kure, shingakuteki ni osoroshii. ……Warukatta na, Idorisu.", en: "Stop, that's theologically terrifying. …I'm sorry, Idris. Truly." },
        ],
      },
      {
        id: "ch7_p6",
        aspect: "landscape",
        beat: "Amara rings the great bell; Tidepup carries her chant inside a wave down the Blue Nile's strand — three dark provinces relight. But Anya's timetable and word from the Adriatic agree: the Censor moves on the walls of Skadar, and his seat lies drowned beneath Lisbon. The long western run begins.",
        cast: ["sl_kagura", "po_aqua"],
        artPrompt:
          "Full-color manga panel: night over the Lalibela highlands. An Ethiopian bell-ringer in a white shamma (Amara) strikes the great bronze bell one full swing; enormous golden rings of interleaved Ge'ez and kanji roll out over the valleys, and along a river-thread of light a small water-otter pup (Tidepup) surfs inside a glowing wave that carries a ribbon of chant, heading north-west. On the horizon-map above, three dark regions of a faint world-lattice flicker back to gold. The kanji 鈴 blazing on the bell.",
        texts: [
          { kind: "speech", speaker: "Amara", ja: "鐘は何も意味しない。ただ、皆を呼ぶ。意味の前の、最初の言葉。", romaji: "Kane wa nani mo imi shinai. Tada, mina o yobu. Imi no mae no, saisho no kotoba.", en: "A bell means nothing. It only calls everyone. The first word before all words." },
          { kind: "caption", ja: "西へ——検閲官の玉座は、リスボンの海の下。その途上、スカダルの壁が包囲されていた。", romaji: "Nishi e—— Ken'etsukan no gyokuza wa, Risubon no umi no shita. Sono tojou, Sukadaru no kabe ga houi sarete ita.", en: "West — the Censor's throne lies drowned beneath Lisbon. And on the way, the walls of Skadar were under siege." },
        ],
      },
    ],
  },
  {
    n: 8,
    id: "ch8",
    titleEn: "The Drowned Library",
    titleJa: "沈んだ書庫",
    titleRomaji: "Shizunda Shoko",
    gateLevel: 35,
    setting: "The long western run — Skadar fortress on the Adriatic road, then the drowned library beneath Lisbon",
    debutCardIds: ["ti_grim", "re_zangetsu", "cu_domain", "ne_ghost", "me_unit", "nc_kesu"],
    kanji: ["巨", "月", "域", "零", "壁"],
    panels: [
      {
        id: "ch8_p1",
        aspect: "landscape",
        beat: "TRAVEL — the western run: up the Adriatic to relieve Skadar. Unit Kappa wades ashore beside the ship — the Threshold Program's loan, a weapon that can only counter, never strike first.",
        cast: ["me_unit", "me_asuka"],
        artPrompt:
          "Full-color manga panel: a grey Adriatic dawn, the dictionary-sailed ship close inshore under a fortress crag. Wading through the shallows beside it, a bio-mechanical giant with a dish-crowned kappa core in its glass chest cavity, water streaming from its shoulders (Unit Kappa), bowing politely to a fisherman who reflexively bows back. On the flyer above, a Lebanese pilot in a crimson jacket (Rania) escorts. Siege-fires glow on the fortress of Skadar ahead. The kanji 零 on the mecha's chestplate.",
        texts: [
          { kind: "caption", ja: "鐘の残響が背を押す。アドリア海を北へ——包囲されたスカダルの壁へ。", romaji: "Kane no zankyou ga se o osu. Adoriakai o kita e—— houi sareta Sukadaru no kabe e.", en: "The bells' echo at their backs, they ran north up the Adriatic — to the besieged walls of Skadar." },
          { kind: "speech", speaker: "Rania", ja: "境界計画の貸与機よ。お辞儀をすれば、お辞儀を返す。先に撃てない——だから信用できる。", romaji: "Kyoukai Keikaku no taiyo-ki yo. Ojigi o sureba, ojigi o kaesu. Saki ni utenai—— dakara shin'you dekiru.", en: "On loan from the Threshold Program. Bow, and it bows back. It cannot strike first — which is exactly why we trust it." },
        ],
      },
      {
        id: "ch8_p2",
        aspect: "spread",
        beat: "Dragan's choice: he lets the wall fall to save the name mortared into it — his grandmother's name rises off the collapsing stones as light. Far beneath every wall on earth, Meridian's stone eye opens, seen only by the reader.",
        cast: ["ti_grim"],
        artPrompt:
          "Full-color manga spread: the fortress of Skadar mid-collapse under grey siege-fog, and a Serbian giant with stone-scaled shoulders (Dragan) NOT holding the wall — arms spread wide instead around a rising ribbon of golden letters lifting off the falling stones: a woman's name in light. Rubble cascades past him harmlessly, fog recoiling from the name. Inset at the very bottom of the spread, deep underground in the dark: a single colossal stone eye opening. The kanji 壁 cracking apart; 巨 on Dragan's gauntlet.",
        texts: [
          { kind: "speech", speaker: "Dragan", ja: "壁は建て直せる。名前は——建て直せない。ばあちゃん、俺は選んだぞ！", romaji: "Kabe wa tatenaoseru. Namae wa—— tatenaosenai. Baa-chan, ore wa eranda zo!", en: "A wall can be rebuilt. A name cannot. Grandmother — I made my choice!" },
          { kind: "caption", ja: "その時、世界中の壁の下で、「礎」が寝返りを打った。", romaji: "Sono toki, sekaijuu no kabe no shita de, \"ishizue\" ga negaeri o utta.", en: "And in that moment, beneath every wall on earth, the Foundation stirred in its sleep." },
        ],
      },
      {
        id: "ch8_p3",
        aspect: "portrait",
        beat: "Gibraltar rounded, Lisbon reached — and White Noise jams every strand. Kojo reduces himself to his kra, a single unerasable spark, and carries the assault plan through the dead black Lattice.",
        cast: ["ne_ghost"],
        artPrompt:
          "Full-color manga panel, near-abstract: a vast black void of severed, drifting dead threads like sunken cables — and crossing it, one defiant golden spark trailing LED-thread light, the barest suggestion of a running Ghanaian hacker with light-threaded braids (Kojo) inside the spark. Above the void's ceiling, faint, the hull-shadow of the ship on the Tagus and the drowned city-glow of Lisbon. The kanji 零 as the spark's core.",
        texts: [
          { kind: "caption", ja: "リスボン沖。すべての糸が妨害された、暗黒の夜。", romaji: "Risubon oki. Subete no ito ga bougai sareta, ankoku no yoru.", en: "Off Lisbon — the night White Noise jammed every thread." },
          { kind: "thought", speaker: "Kojo", ja: "ニャメがくれた魂の火種——クラ。消せるもんなら消してみろ。ゼロは、割れない。", romaji: "Nyame ga kureta tamashii no hidane—— kura. Keseru mon nara keshite miro. Zero wa, warenai.", en: "The soul-spark Nyame gave me — my kra. Erase THIS if you can. Zero doesn't break." },
        ],
      },
      {
        id: "ch8_p4",
        aspect: "landscape",
        beat: "The drowned library beneath Lisbon: shelves under green water, every book pristine — the Censor cannot destroy what he erased; it is all he has. Mateus opens his saudade-domain, and inside an untranslatable word, quotation fails.",
        cast: ["cu_domain", "nc_kesu"],
        artPrompt:
          "Full-color manga panel: a cathedral-sized library drowned since 1755, shelves rising out of clear green water, every book pristine, fish drifting through shafts of light between unreadable spines. On the flooded floor kneels the gaunt many-empires scribe (the Censor), his ribbons of quotation dissolving into bubbles around him. Standing on the water's surface, a Portuguese man in a sea-worn coat with distant eyes (Mateus) has opened his hands; the whole scene inside a soft golden boundary where the light aches like a memory of home. The kanji 域 at the domain's rim.",
        texts: [
          { kind: "speech", speaker: "Mateus", ja: "ようこそ、「サウダーデ」へ。訳せない言葉の中では——引用は、できない。", romaji: "Youkoso, \"saudaade\" e. Yakusenai kotoba no naka de wa—— in'you wa, dekinai.", en: "Welcome to saudade. Inside an untranslatable word — there is nothing you can quote." },
          { kind: "speech", speaker: "The Censor", ja: "……《…》……《……》……", romaji: "……《…》……《……》……", en: "…'…' …'…'…" },
        ],
      },
      {
        id: "ch8_p5",
        aspect: "portrait",
        beat: "Kwame's defining act: the moon-mirror shows the Censor the scribe he was before empires. He does not die; he stops — and surrenders the timetable. His last kept word: the name of the first library he failed to save.",
        cast: ["re_zangetsu", "nc_kesu"],
        artPrompt:
          "Full-color manga panel: in the drowned library's green light, a Ghanaian courier in an adinkra-patterned cloak (Kwame) holds up a round moon-mirror pendant that blazes soft silver. In its reflected beam, the gaunt Censor sees himself as he was: a young scribe with ink-stained fingers, laughing among scroll-racks. The old hollow's ink-black eyes crack with the first color in a thousand years. Water-light ripples on both faces. The kanji 月 in the mirror's rim.",
        texts: [
          { kind: "speech", speaker: "Kwame", ja: "月は記憶の鏡だ。裁かない。ただ、正しく思い出させる。", romaji: "Tsuki wa kioku no kagami da. Sabakanai. Tada, tadashiku omoidasaseru.", en: "The moon is memory's mirror. It doesn't judge. It only remembers you — accurately." },
          { kind: "speech", speaker: "The Censor", ja: "……ナランジャラ。私が守れなかった、最初の書庫の名だ。持っていけ——彗星の時刻表も。", romaji: "……Naranjara. Watashi ga mamorenakatta, saisho no shoko no na da. Motte ike—— suisei no jikokuhyou mo.", en: "…Naranjala. The first library I failed. Take it — and take the comet's timetable." },
        ],
      },
      {
        id: "ch8_p6",
        aspect: "landscape",
        beat: "Two moons settle it kindly on the Tagus quay: Kwame the mirror, Noor the road. The timetable read aloud: the Long Return arrives within the year, and 'the Mouth opens where marks began.' The homeward run east begins — toward India.",
        cast: ["re_zangetsu", "lu_tsukina"],
        artPrompt:
          "Full-color manga panel: night on a Lisbon quay, the ship refitting behind. A Ghanaian courier with a moon-mirror pendant (Kwame) and an Egyptian moon-sister in indigo robes (Noor) sit on bollards under one huge moon, laughing quietly, a shared paper of the timetable between them. On the water, her moonlight-road stretches east up the Tagus; in his mirror, the same moon reflected. Around them the party loads stores. The kanji 月 doubled — in mirror and on water.",
        texts: [
          { kind: "speech", speaker: "Noor", ja: "あなたの月は鏡、私の月は道。ね、ケンカする理由が一つもない。", romaji: "Anata no tsuki wa kagami, watashi no tsuki wa michi. Ne, kenka suru riyuu ga hitotsu mo nai.", en: "Your moon's the mirror, mine's the road. See? Nothing to fight over." },
          { kind: "speech", speaker: "Kwame", ja: "時刻表いわく——「帰還」は年内。口は、印の始まった場所に開く。……東だ。帰り道が、戦場になる。", romaji: "Jikokuhyou iwaku—— \"Kikan\" wa nennai. Kuchi wa, shirushi no hajimatta basho ni hiraku. ……Higashi da. Kaerimichi ga, senjou ni naru.", en: "The timetable says: the Return comes within the year. The Mouth opens where marks began. …East. The road home is the battlefield." },
        ],
      },
    ],
  },
  {
    n: 9,
    id: "ch9",
    titleEn: "Rain Reads the Sky",
    titleJa: "雨は空を読む",
    titleRomaji: "Ame wa Sora o Yomu",
    gateLevel: 40,
    setting: "The monsoon Indian Ocean — the homeward run east, under the year's first great rains",
    debutCardIds: ["ho_rain", "ch_dragon", "sh_knight", "he_bond", "sp_ohtori", "nc_wasure"],
    kanji: ["雨", "竜", "盾", "予", "空", "忘"],
    panels: [
      {
        id: "ch9_p1",
        aspect: "landscape",
        beat: "TRAVEL — through Suez a third time and out into the monsoon Indian Ocean; Dao arrives walking down the rain itself, reading the coming weather like text, with Nibbles asleep in his hat.",
        cast: ["ho_rain", "ch_dragon"],
        artPrompt:
          "Full-color manga panel: the dictionary-sailed ship plunging east through vast monsoon swells, warm grey rain in curtains. Down one slanting sheet of rain walks a Thai rain-keeper in a straw hat hung with rain-beads (Dao), perfectly dry, one finger tracing lines of falling drops that glow briefly like columns of text as he reads them. Curled asleep in his hat-brim, a palm-sized dragon (Nibbles). The kanji 雨 written by raindrops mid-air.",
        texts: [
          { kind: "caption", ja: "三度目のスエズ。そして季節風の海へ——帰り道は、雨の中。", romaji: "Sandome no Suezu. Soshite kisetsufuu no umi e—— kaerimichi wa, ame no naka.", en: "Suez, a third time. Then out into the monsoon sea — the road home runs through the rain." },
          { kind: "speech", speaker: "Dao", ja: "空は未来の下書きを湿度で書く。読める者には、な。……ほら、明日の午後、来客が二人。", romaji: "Sora wa mirai no shitagaki o shitsudo de kaku. Yomeru mono ni wa, na. ……Hora, ashita no gogo, raikyaku ga futari.", en: "The sky drafts the future in humidity — if you can read it. …See there: two visitors, tomorrow afternoon." },
        ],
      },
      {
        id: "ch9_p2",
        aspect: "portrait",
        beat: "Tomas and Biscuit arrive along the last Atlantic thread before it dims: the shadow-knight of Zumbi at his back, the precognitive dog at his heel — and Biscuit's blind spots, plotted on Zola's charts, begin to spell something.",
        cast: ["sh_knight", "he_bond", "ti_hana"],
        artPrompt:
          "Full-color manga panel: the ship's chart-room, lamplight swinging with the swell. A Brazilian summoner (Tomas) steadies himself, behind him the towering translucent shadow-knight of Zumbi standing guard through the ceiling; at his feet a scruffy dog in a bandana (Biscuit) stares fixedly at a huge aerial chart pinned to the table while a South African wing-scout (Zola) inks black dots wherever the dog's gaze goes blank. The dots are beginning to form strokes of a giant character. The kanji 盾 on the knight's shield; 予 forming in the dots.",
        texts: [
          { kind: "speech", speaker: "Tomas", ja: "この盾は三百年、消され続けて消えなかった名だ。ズンビ。今夜から君らのものでもある。", romaji: "Kono tate wa sanbyaku-nen, kesare tsuzukete kienakatta na da. Zunbi. Kon'ya kara kimira no mono de mo aru.", en: "This shield is a name they've tried to erase for three centuries and failed: Zumbi. From tonight it's yours too." },
          { kind: "speech", speaker: "Zola", ja: "見て——犬の「見えない場所」を全部打点すると……字になる。", romaji: "Mite—— inu no \"mienai basho\" o zenbu daten suru to…… ji ni naru.", en: "Look — plot every spot the dog can't see the future of… and it spells." },
        ],
      },
      {
        id: "ch9_p3",
        aspect: "portrait",
        beat: "Echo, stowed away since Istanbul, is cornered on deck trying to lift Nayeli's sky-word as she arrives from the west on the feathered serpent. Caught — not punished. Sen sits down with him instead.",
        cast: ["sp_ohtori", "nc_echo"],
        artPrompt:
          "Full-color manga panel: the rain breaking to sudden gold as an iridescent feathered serpent spirals down out of the clouds, ridden by a Mexican sky-rider with jade earplugs (Nayeli). On the deck below, a silver-haired Icelandic boy (Echo) is frozen mid-reach, stolen words scattering from his coat like startled moths, ringed by the unimpressed party. His face has stopped pretending. The kanji 空 blazing along the serpent's wing-feathers.",
        texts: [
          { kind: "speech", speaker: "Nayeli", ja: "ケツァルコアトルは書物と暦を人にくれた神。その空の言葉を——盗む気？", romaji: "Ketsarukoatoru wa shomotsu to koyomi o hito ni kureta kami. Sono sora no kotoba o—— nusumu ki?", en: "Quetzalcoatl gave humans their books and their calendar. And you'd steal his sky-word?" },
          { kind: "speech", speaker: "Echo", ja: "……もう疲れたんだ。盗んだ言葉は全部、口の中で灰の味がする。", romaji: "……Mou tsukareta n da. Nusunda kotoba wa zenbu, kuchi no naka de hai no aji ga suru.", en: "…I'm so tired. Every word I've stolen tastes like ash in my mouth." },
        ],
      },
      {
        id: "ch9_p4",
        aspect: "spread",
        beat: "Sen and Echo cross-legged on the deckhouse roof under clearing stars: Sen teaches him ONE word the slow way — the first thing he has meant in years. Every stolen word in him hollows to ash except that one. He turns, and hands over the Court's supply-map.",
        cast: ["nc_echo", "nc_tsuru"],
        artPrompt:
          "Full-color manga spread: night ocean, rain ended, extraordinary stars. On the deckhouse roof a slight teen in a dark windbreaker (Sen, back to camera) and a silver-haired Icelandic boy (Echo) sit cross-legged facing each other; between them a single small word glows like a shared coal, passed hand to hand. Around Echo, dozens of orbiting stolen words crumble one by one into drifting grey ash — except the one. An origami crane watches from the rigging. Tender, vast, quiet.",
        texts: [
          { kind: "speech", speaker: "Sen", ja: "ゆっくりでいい。形、意味、使い方。——「ともしび」。", romaji: "Yukkuri de ii. Katachi, imi, tsukaikata. —— \"Tomoshibi\".", en: "Slowly is fine. Shape, meaning, use. — 'Tomoshibi.' A small, kept flame." },
          { kind: "speech", speaker: "Echo", ja: "ともしび。……ああ。灰の味がしない。初めてだ、何年ぶりかで——本気の言葉だ。", romaji: "Tomoshibi. ……Aa. Hai no aji ga shinai. Hajimete da, nan-nen buri ka de—— honki no kotoba da.", en: "Tomoshibi. …Oh. No taste of ash. For the first time in years — a word I mean." },
          { kind: "caption", ja: "翌朝、彼は宮廷の補給地図を差し出した。", romaji: "Yokuasa, kare wa kyuutei no hokyuu chizu o sashidashita.", en: "By morning, he had handed over the Court's supply-map." },
        ],
      },
      {
        id: "ch9_p5",
        aspect: "portrait",
        beat: "Halime arrives — not to fight. Grandfather Ash's memory of her reached her along a strand she thought severed. An old librarian, not a monster, library-dust falling through her hollow like snow. She defects.",
        cast: ["nc_wasure"],
        artPrompt:
          "Full-color manga panel: the ship's deck at grey dawn. Stepping from a thin, impossibly old thread of light: an elderly Ottoman librarian in archivist's robes (Halime), lowering her hood — inside her outline, instead of shadow, fine library-dust falls slowly like snow. She holds out empty hands. The party stands wary but no one draws. Warm steam-scent implied: a faint image of a bathhouse reflected in her eyes. The kanji 忘 fading on her robe's clasp.",
        texts: [
          { kind: "speech", speaker: "Halime", ja: "湯屋の主人が、まだ私を覚えていた。……糸は切れていなかった。だから、来られた。", romaji: "Yuya no shujin ga, mada watashi o oboete ita. ……Ito wa kirete inakatta. Dakara, korareta.", en: "The bathhouse keeper still remembered me. …The thread was never cut. So I could come." },
          { kind: "speech", speaker: "Halime", ja: "言葉を使わせず金庫にしまって守ろうとした。金庫の中で、言葉は死ぬ。私は間違えた。", romaji: "Kotoba o tsukawasezu kinko ni shimatte mamorou to shita. Kinko no naka de, kotoba wa shinu. Watashi wa machigaeta.", en: "I tried to save words by locking them away unused. In the vault, a word dies. I was wrong." },
        ],
      },
      {
        id: "ch9_p6",
        aspect: "landscape",
        beat: "Halime tells Mu's whole story — the comet, the first word, the recoil — as Biscuit's blind-spot chart resolves: the Mouth opens where humanity first made lasting marks. Bhimbetka. India. Home. The enemy becomes legible; pity arrives, and with it the real plan.",
        cast: ["nc_wasure", "he_bond"],
        artPrompt:
          "Full-color manga panel: the chart-room at night, the whole party crowded in. An elderly hollow librarian with dust-snow falling inside her outline (Halime) stands at the table telling a story, and above her the lamplight forms it: an ancient sky, a comet, a dying speaker with no one to hear, one thread snapping into a spreading grey wave. On the table, the dog's blind-spot chart finished: the dots spell a location deep in central India. A scruffy dog (Biscuit) sits proudly on the chart. Grief and resolve on every face.",
        texts: [
          { kind: "speech", speaker: "Halime", ja: "無は怪物ではない。「誰にも意味されなくなった、最初の言葉」——千二百年、形のない痛みなのです。", romaji: "Mu wa kaibutsu de wa nai. \"Dare ni mo imi sarenaku natta, saisho no kotoba\" —— sen-nihyaku-nen, katachi no nai itami na no desu.", en: "Mu is no monster. It is the first word, left meant by no one — twelve hundred years of pain without a shape." },
          { kind: "caption", ja: "口が開く場所——人類が初めて印を刻んだ岩。ビンベットカ。一行の帰り道の、その先に。", romaji: "Kuchi ga hiraku basho—— jinrui ga hajimete shirushi o kizanda iwa. Binbettoka. Ikkou no kaerimichi no, sono saki ni.", en: "Where the Mouth opens: the rocks where humanity first made lasting marks. Bhimbetka — at the far end of the road home." },
        ],
      },
    ],
  },
  {
    n: 10,
    id: "ch10",
    titleEn: "For the Unwritten Books",
    titleJa: "語られぬ書物のために",
    titleRomaji: "Katararenu Shomotsu no Tame ni",
    gateLevel: 44,
    setting: "Mumbai and the Konkan coast — landfall in India, where White Noise makes his stand",
    debutCardIds: ["vo_yonko", "ps_awaken", "po_legend", "nc_moku"],
    kanji: ["覇", "覚", "雷"],
    panels: [
      {
        id: "ch10_p1",
        aspect: "landscape",
        beat: "TRAVEL/ARRIVAL — landfall at Mumbai, loudest harbor of the subcontinent: a wall of broadcast towers already grey with static. The Hush's last offensive before the comet — annihilate the ORAL: the epics, lineages, and chants that live only in memory.",
        cast: ["nc_moku"],
        artPrompt:
          "Full-color manga panel: the dictionary-sailed ship entering Mumbai harbor at dusk past the Gateway of India — but the city's skyline of broadcast towers and billboards is smothered under a dome of drifting grey static, every screen hissing snow. On the tallest tower, tiny and terrible, stands a hollow man made of drifting static wearing a crown of headphones (White Noise). Rain-wet crowds walk with mouths moving and no sound. The kanji 黙 flickering in the static dome.",
        texts: [
          { kind: "caption", ja: "インド上陸。彗星の前の、最後の攻勢——狙いは「書かれていない書物」。口伝の叙事詩、系譜、祈り。", romaji: "Indo jouriku. Suisei no mae no, saigo no kousei—— nerai wa \"kakarete inai shomotsu\". Kuden no jojishi, keifu, inori.", en: "Landfall in India. The last offensive before the comet — aimed at the unwritten books: the spoken epics, lineages, prayers." },
          { kind: "speech", speaker: "White Noise", ja: "《ただいまチャンネル登録者数……》全員が話し、誰も、意味しない。", romaji: "《Tadaima channeru tourokusha-suu……》 Zen'in ga hanashi, dare mo, imi shinai.", en: "'Your current subscriber count is…' Everyone speaking. No one meaning." },
        ],
      },
      {
        id: "ch10_p2",
        aspect: "portrait",
        beat: "Olamide lattice-walks in from Timbuktu with the griots' answer: dispersal. His ancestors saved the manuscripts by scattering them into living memory — now every keeper memorizes a share of the Vedic chants. The party literally becomes a library.",
        cast: ["vo_yonko", "sh_rookie"],
        artPrompt:
          "Full-color manga panel: a sand-floored temple courtyard in the old city, monsoon lamps burning. A towering West African sea-sovereign in a cloak sewn from kente sailcloth (Olamide) stands at the center of a seated circle of the whole party plus Sanskrit reciters; from the reciters' mouths, lines of glowing text flow up the keepers' arms and settle under their skin like tattoos of light. A Korean rookie (Minjae) scribbles joyfully, text winding up his pencil arm. The kanji 覇 woven into Olamide's cloak.",
        texts: [
          { kind: "speech", speaker: "Olamide", ja: "ティンブクトゥの写本は、家々に散らして守った。今夜は君らが書庫になれ。一人一章——焼ける書庫は、もう無い。", romaji: "Tinbukutu no shahon wa, ieie ni chirashite mamotta. Kon'ya wa kimira ga shoko ni nare. Hitori isshou—— yakeru shoko wa, mou nai.", en: "We saved Timbuktu's manuscripts by scattering them house to house. Tonight, YOU become the library. One chapter each — a library that cannot burn." },
          { kind: "speech", speaker: "Minjae", ja: "最下位ハンター、第三章いただきます！！", romaji: "Saikai hantaa, dai-san-shou itadakimasu!!", en: "Lowest-ranked hunter, claiming chapter three!!" },
        ],
      },
      {
        id: "ch10_p3",
        aspect: "spread",
        beat: "Total static: every panel border dissolving — except one small clear space where Haru breathes. He finally hears what he has feared his whole life: everyone speaking, no one meaning. Everything he was afraid he was.",
        cast: ["ps_mob", "nc_moku"],
        artPrompt:
          "Full-color manga spread designed to feel like signal failure: a Mumbai intersection where buildings, crowds and sky are all dissolving into roaring grey-white static, edges of the very scene fraying — and at dead center one small, perfectly clear circle of still air in which a Japanese schoolboy in uniform (Haru) stands with his eyes closed, breathing. Above the chaos, a hollow man of drifting static with a headphone crown (White Noise) spreads his arms like a conductor.",
        texts: [
          { kind: "speech", speaker: "White Noise", ja: "《声を上げよう》《話題沸騰》《みんな言ってる》——ほら、君の悪夢だ、少年。全員が喋る世界。", romaji: "《Koe o ageyou》《wadai futtou》《minna itteru》—— hora, kimi no akumu da, shounen. Zen'in ga shaberu sekai.", en: "'Raise your voice.' 'Trending now.' 'Everyone's saying it.' — Behold your nightmare, boy: a world where everyone talks." },
          { kind: "sfx", ja: "ザァァァァ", romaji: "zaaaaa", en: "SHHHHHH" },
        ],
      },
      {
        id: "ch10_p4",
        aspect: "spread",
        beat: "Haru's awakening (覚) — not an explosion, the opposite: he says, out loud, once, completely, exactly what he feels. The unfiltered meant sentence of a lifetime deletes the static like a struck tuning fork. One page, one bubble, and the city silent around it.",
        cast: ["ps_awaken"],
        artPrompt:
          "Full-color manga spread, radical stillness: the static entirely gone in one clean instant, a rain-washed Mumbai street standing in absolute quiet, every person frozen mid-step, listening. At the center, a Japanese schoolboy (Haru) with his eyes open and clear, hair lifting in a windless air, one hand over his heart, having just spoken. The kanji 覚 hangs above him in pale gold like a struck bell's afterimage. Minimal, vast, luminous.",
        texts: [
          { kind: "speech", speaker: "Haru", ja: "ぼくは、ずっと怖かった。全部言ったら、世界が壊れる気がして。——でも今は、君たちが壊れる方が怖い。だから言う。ぼくは、ここにいる。", romaji: "Boku wa, zutto kowakatta. Zenbu ittara, sekai ga kowareru ki ga shite. —— Demo ima wa, kimitachi ga kowareru hou ga kowai. Dakara iu. Boku wa, koko ni iru.", en: "I've been afraid my whole life — that if I said everything, the world would break. But now I'm more afraid of losing all of you. So I'll say it. I am here." },
        ],
      },
      {
        id: "ch10_p5",
        aspect: "portrait",
        beat: "Rafa walks into the monsoon-storm's eye over the Arabian Sea and does not summon Stormcrown — the wordless thunder the Vedas called Rudra, the Roarer — he introduces himself. Awe answers a request where it refused every command in recorded history.",
        cast: ["po_satoru", "po_legend"],
        artPrompt:
          "Full-color manga panel: a beach on the Konkan coast under an apocalyptic monsoon storm-wall, lightning veining a cloud-beast the size of the sky with antlers of light (Stormcrown). At the water's edge, absolutely tiny, a small Oaxacan boy in an embroidered vest (Rafa) raises one hand in a cheerful wave, hair whipping. The storm's whole face is turning toward him — leaning down. The kanji 雷 written in a lightning fork.",
        texts: [
          { kind: "caption", ja: "ヴェーダはこの雷を「ルドラ」と呼んだ——吠えるもの。言葉より古い、畏れそのもの。", romaji: "Veeda wa kono kaminari o \"Rudora\" to yonda—— hoeru mono. Kotoba yori furui, osore sono mono.", en: "The Vedas named this thunder Rudra — the Roarer. Older than words: awe itself." },
          { kind: "speech", speaker: "Rafa", ja: "はじめまして！　ぼくはラファ。命令じゃないよ——お願いなんだ。友だちが、あぶないの。", romaji: "Hajimemashite! Boku wa Rafa. Meirei ja nai yo—— onegai nan da. Tomodachi ga, abunai no.", en: "Nice to meet you! I'm Rafa. This isn't an order — it's a request. My friends are in danger." },
          { kind: "sfx", ja: "ゴロ……ゴロゴロ……", romaji: "goro…… gorogoro……", en: "RMMM… RMMBLE…" },
        ],
      },
      {
        id: "ch10_p6",
        aspect: "portrait",
        beat: "HEARTBREAK/GRACE — White Noise, unhollowed at the end, remembers his own name for one panel before dissolving into clean rain; it is written down in Minjae's notebook, where the reader can find it. The Court is broken. Inland, the comet-road and the rocks of Bhimbetka wait.",
        cast: ["nc_moku", "sh_rookie"],
        artPrompt:
          "Full-color manga panel: rooftop in soft rain after the storm. The static-man's body dissolving from the feet up into clean silver rain — but his face, for this one panel, is a human face: a tired radio engineer, eyes closed, almost smiling. Kneeling nearby, a Korean rookie hunter (Minjae) writes carefully in a rain-spotted school notebook, sheltering the page with his body. The kanji 黙 dissolving into 雨. Quiet mercy.",
        texts: [
          { kind: "speech", speaker: "White Noise", ja: "……思い出した。俺の名前。……ちゃんと、意味して呼んでくれるか。", romaji: "……Omoidashita. Ore no namae. ……Chanto, imi shite yonde kureru ka.", en: "…I remember it. My name. …Will you say it like you mean it?" },
          { kind: "speech", speaker: "Minjae", ja: "書いた。おれのノートは忘れない。——安らかに、先輩。", romaji: "Kaita. Ore no nooto wa wasurenai. —— Yasuraka ni, senpai.", en: "It's written. My notebook doesn't forget. — Rest now, senpai." },
          { kind: "caption", ja: "内陸へ。岩の絵の谷まで、あと五百キロ。空には——帰ってくる光。", romaji: "Nairiku e. Iwa no e no tani made, ato gohyaku-kiro. Sora ni wa—— kaette kuru hikari.", en: "Inland now. Five hundred kilometers to the valley of painted rocks. And in the sky — a returning light." },
        ],
      },
    ],
  },
  {
    n: 11,
    id: "ch11",
    titleEn: "The Long Return",
    titleJa: "千二百年目の帰還",
    titleRomaji: "Sen-nihyaku-nen-me no Kikan",
    gateLevel: 46,
    setting: "The high sky over the Indian Ocean night — the last lit strand, flown from the Deccan to meet the comet",
    debutCardIds: ["ho_comet", "me_angel"],
    kanji: ["彗", "神", "紙"],
    panels: [
      {
        id: "ch11_p1",
        aspect: "portrait",
        beat: "TRAVEL, VERTICAL — from the Deccan plateau, Nayeli's feathered serpent climbs the last lit sky-strand out of the cloud deck, the vanguard on its back; cities glow through cloud like embers below.",
        cast: ["sp_ohtori", "nc_tsuru"],
        artPrompt:
          "Full-color manga panel, vertiginous: an iridescent feathered serpent spiraling up a single golden thread of light that rises out of a moonlit cloud deck into thin starry blackness. On its back, small: a Mexican sky-rider (Nayeli), a slight teen in a dark windbreaker (Sen), a tiny German girl in an oversized coat (Pip), an origami crane tucked into Sen's collar. Below, the Deccan's cities glow through cloud like scattered embers. Cold, holy altitude.",
        texts: [
          { kind: "caption", ja: "デカン高原から、最後の灯る糸を垂直に。忘却より古い光に、会いに行く。", romaji: "Dekan kougen kara, saigo no tomoru ito o suichoku ni. Boukyaku yori furui hikari ni, ai ni iku.", en: "Up the last lit strand from the Deccan — to meet a light older than the forgetting." },
          { kind: "speech", speaker: "Nayeli", ja: "しっかりつかまって。ここから先、空は神様の書斎よ。", romaji: "Shikkari tsukamatte. Koko kara saki, sora wa kamisama no shosai yo.", en: "Hold on tight. From here up, the sky is a god's study." },
        ],
      },
      {
        id: "ch11_p2",
        aspect: "spread",
        beat: "The Pattern manifests — grammar itself, self-aware — and tests the fellowship in the one language it speaks: structure. It swaps their voices, grammar, pronouns, and watches whether meaning survives translation into pure form.",
        cast: ["me_angel"],
        artPrompt:
          "Full-color manga spread: high above the cloud deck, a vast geometric angelic entity of nested lattices, golden ratios and rotating grammatical trees (The Pattern) fills the sky before the tiny feathered serpent. The party's own speech renders visibly AROUND them as luminous diagrammed sentences being lifted, rotated, and swapped between their mouths like moving architecture. Beautiful, alien, not hostile. The kanji 神 at the entity's silent center.",
        texts: [
          { kind: "speech", speaker: "The Pattern", ja: "文法ハ言葉ヨリ古イ。試ス——器ヲ替エテ、意味ハ残ルカ。", romaji: "Bunpou wa kotoba yori furui. Tamesu—— utsuwa o kaete, imi wa nokoru ka.", en: "GRAMMAR IS OLDER THAN WORDS. THE TEST: EXCHANGE THE VESSELS — DOES MEANING REMAIN?" },
          { kind: "speech", speaker: "Sen", ja: "（ナヤリの声で）わ、わたしの声！？", romaji: "(Nayari no koe de) Wa, watashi no koe!?", en: "(in Nayeli's voice) Th-that's my voice!?" },
        ],
      },
      {
        id: "ch11_p3",
        aspect: "portrait",
        beat: "Pip passes the test for everyone: meaning, heard directly, doesn't move when the words do — Ch4's keystone, weight-bearing at last.",
        cast: ["he_anya", "me_angel"],
        artPrompt:
          "Full-color manga panel: a tiny German girl in an oversized coat (Pip) floating fearless in star-dark air before one facet of the vast geometric entity, her eyes closed, hands to her temples; beneath every scrambled, swapped luminous sentence around her, a second layer glows steady and unmoved — warm color under the shifting diagrams. The geometry has paused, all its rotations stopped to listen.",
        texts: [
          { kind: "speech", speaker: "Pip", ja: "声が入れかわっても、下の「あったかいところ」は動いてない。みんな、ちゃんと、みんなのまま。", romaji: "Koe ga irekawatte mo, shita no \"attakai tokoro\" wa ugoitenai. Minna, chanto, minna no mama.", en: "Even with the voices swapped, the warm part underneath didn't move. Everyone is still everyone." },
          { kind: "speech", speaker: "The Pattern", ja: "……可。意味ハ形ヲ生キ延ビタ。", romaji: "……Ka. Imi wa katachi o ikinobita.", en: "…PASS. MEANING SURVIVED ITS FORM." },
        ],
      },
      {
        id: "ch11_p4",
        aspect: "portrait",
        beat: "COMEDY, tiny and cosmic — Tsuru, made of paper, makes the kami 紙/神 pun to a geometric god. The Pattern does not laugh, but adjusts one angle, which Tsuru insists counts.",
        cast: ["nc_tsuru", "me_angel"],
        artPrompt:
          "Full-color manga panel: intimate scale against cosmic backdrop — a small scorched origami crane (Tsuru) perched on empty starlit air, wings spread in a showman's ta-daa at one immense golden facet of the geometric entity. In the geometry, one single angle has shifted by a few degrees, faintly luminous, like a suppressed smile. Stars everywhere. The kanji 紙 and 神 side by side in the crane's wing-print.",
        texts: [
          { kind: "speech", speaker: "Tsuru", ja: "紙でできた身が、神に物申す——ほら、日本語では同じ「かみ」です。", romaji: "Kami de dekita mi ga, kami ni monomousu—— hora, nihongo de wa onaji \"kami\" desu.", en: "A being of paper, addressing a god — in Japanese, you see, both are 'kami.'" },
          { kind: "speech", speaker: "Tsuru", ja: "今、角度が笑いました。記録します。", romaji: "Ima, kakudo ga waraimashita. Kiroku shimasu.", en: "An angle just laughed. I am writing that down." },
        ],
      },
      {
        id: "ch11_p5",
        aspect: "spread",
        beat: "The comet's testimony arrives as light: the sky of 1,200 years ago falls on upturned faces — rendered as the negative of every dark panel so far — and under it, faint, the mouth-shape of the first word.",
        cast: ["ho_comet"],
        artPrompt:
          "Full-color manga spread, inverted luminosity: the comet (the Long Return) filling the sky, its tail an archive of ancient light — and within the light, ghost-clear, the night sky of twelve hundred years ago: older constellations, a river valley, small fires, and the faint enormous after-image of human lips forming a word. The party on the serpent below, faces upturned and lit as if by dawn, colors rendered like a photographic negative turned holy. The kanji 彗 as the comet's core.",
        texts: [
          { kind: "caption", ja: "証言は、光の形で届いた。忘却の前の空。その下で最後に動いた、くちびるの形。", romaji: "Shougen wa, hikari no katachi de todoita. Boukyaku no mae no sora. Sono shita de saigo ni ugoita, kuchibiru no katachi.", en: "The testimony arrived as light: the sky before the forgetting — and beneath it, the last shape of the lips that spoke." },
          { kind: "speech", speaker: "Pip", ja: "きこえる……はじまりの言葉の、のこりの音。", romaji: "Kikoeru…… hajimari no kotoba no, nokori no oto.", en: "I can hear it… the leftover sound of the first word." },
        ],
      },
      {
        id: "ch11_p6",
        aspect: "portrait",
        beat: "The Pattern grants the instrument: an empty grammatical slot — a lawful place in language where a new name can live — laid in Sen's hands like a bracket of light. Descent: below, at Bhimbetka, the Mouth is opening. Sixty threads converge.",
        cast: ["me_angel", "nc_tsuru"],
        artPrompt:
          "Full-color manga panel: the geometric entity extends one impossibly fine golden filament and lays a small empty bracket of pure light — an open slot, like a frame awaiting a word — into the cupped hands of a slight teen in a dark windbreaker (Sen, face out of frame, hands central). Below through cloud, a rocky Indian valley glows with converging threads of light from every horizon, and a darkness shaped like an opening mouth. Awe without terror.",
        texts: [
          { kind: "speech", speaker: "The Pattern", ja: "空欄ヲ授ケル。名ガ、合法ニ住メル場所ダ。正シク埋メヨ。", romaji: "Kuuran o sazukeru. Na ga, gouhou ni sumeru basho da. Tadashiku umeyo.", en: "RECEIVE THE EMPTY SLOT. A PLACE WHERE A NAME MAY LAWFULLY DWELL. FILL IT CORRECTLY." },
          { kind: "caption", ja: "眼下——ビンベットカ。六十本の糸が、岩の絵の谷に結ばれていく。", romaji: "Ganka—— Binbettoka. Rokujuppon no ito ga, iwa no e no tani ni musubarete iku.", en: "Below: Bhimbetka. Sixty threads, knotting themselves into the valley of painted rocks." },
        ],
      },
    ],
  },
  {
    n: 12,
    id: "ch12",
    titleEn: "Say Its Name",
    titleJa: "名を呼べ",
    titleRomaji: "Na o Yobe",
    gateLevel: 48,
    setting: "The Bhimbetka rock shelters, Madhya Pradesh — where the Mouth opens into the Unwritten Sea",
    debutCardIds: [
      "re_king", "lu_queen", "sl_akatsuki", "cu_king",
      "ti_founder", "ne_titan", "sh_monarch", "nc_mu",
    ],
    kanji: ["無", "霊", "后", "暁", "災", "礎", "鋼", "王"],
    panels: [
      {
        id: "ch12_p1",
        aspect: "spread",
        beat: "All sixty keepers stand among Bhimbetka's painted rocks at first light — cave art and living cast in one continuous mural; Ravindra holds sovereignty over the ground where words were first cut in stone.",
        cast: ["sh_monarch"],
        artPrompt:
          "Full-color manga spread, the saga's poster image: the Bhimbetka rock shelters at first light — ochre cave paintings of hunters and dancers flowing seamlessly into the assembled sixty keepers standing among the rocks, painted figures and living figures forming one continuous mural. At the center, an Indian shadow monarch with an edict-pillar staff (Ravindra) drives the staff into the ground; carved edicts light up along the rock like veins. Threads of light from every horizon knot overhead. The kanji 王 at the staff's crown.",
        texts: [
          { kind: "caption", ja: "六十人の守り手が、初めて一つ所に立った。人類が最初に印を刻んだ、岩の谷に。", romaji: "Rokujuunin no mamorite ga, hajimete hitotsu tokoro ni tatta. Jinrui ga saisho ni shirushi o kizanda, iwa no tani ni.", en: "For the first time, all sixty keepers stood in one place — the valley where humanity first cut its marks." },
          { kind: "speech", speaker: "Ravindra", ja: "アショーカは石に刻んだ——王の言葉は王より長く生きよ、と。この地は言葉の側だ。無よ、来い。", romaji: "Ashooka wa ishi ni kizanda—— ou no kotoba wa ou yori nagaku ikiyo, to. Kono chi wa kotoba no gawa da. Mu yo, koi.", en: "Ashoka carved it in stone: let a king's words outlive the king. This ground sides with language. Come, Mu." },
        ],
      },
      {
        id: "ch12_p2",
        aspect: "landscape",
        beat: "Aurelio opens the dawn-door: the two-faced keeper of thresholds stands the watch at first light, and the Mouth opens into the Unwritten Sea. Sable's verdict gives the descent its legal ground: even erasure is owed a hearing — and a hearing requires a name.",
        cast: ["sl_akatsuki", "re_king"],
        artPrompt:
          "Full-color manga panel: at the largest rock shelter's natural arch, a Roman dawn-keeper with a two-faced Janus medallion (Aurelio) raises both hands as the first sun-ray strikes the arch — the rock opens like a door onto an impossible horizonless whiteness. Beside him, an androgynous French sovereign in tidal robes holding a psychopomp's lantern (Sable) reads formally from a ledger of verdicts. Sixty silhouettes brace in the dawn wind. The kanji 暁 in the sunray; 霊 on the lantern.",
        texts: [
          { kind: "caption", ja: "シヴァの溶解は再生の前段——静寂は溶解だけを盗んだ、再生なき偽物。", romaji: "Shiva no youkai wa saisei no zendan—— Shijima wa youkai dake o nusunda, saisei naki nisemono.", en: "Shiva's dissolution precedes renewal. The Hush stole only the dissolving — a counterfeit with no rebirth." },
          { kind: "speech", speaker: "Aurelio", ja: "夜明けは毎朝の証明だ——闇は越えられる。扉よ、開け。", romaji: "Yoake wa maiasa no shoumei da—— yami wa koerareru. Tobira yo, hirake.", en: "Dawn is the daily proof that dark can be survived. Door — open." },
          { kind: "speech", speaker: "Sable", ja: "終語裁の裁定——消去にも審理を受ける権利がある。而して審理には、名が要る。", romaji: "Shuugosai no saitei—— shoukyo ni mo shinri o ukeru kenri ga aru. Shikashite shinri ni wa, na ga iru.", en: "The Court rules: even erasure is owed a hearing. And a hearing requires a name." },
        ],
      },
      {
        id: "ch12_p3",
        aspect: "portrait",
        beat: "Vesna redeemed on the shelter floor: the party burns Morana's effigy and calls spring by name — the rite performed and meant relights the goddess, and calamity's crown cracks off her shoulders. A lieutenant turned home by one relit rite.",
        cast: ["cu_king", "sl_honoka"],
        artPrompt:
          "Full-color manga panel: on the rock-shelter floor before the white Mouth, a straw effigy of winter (Morana) burns in a ring of keepers, and through the flames walks a hollowed sorceress-queen crowned in black calamity-iron (Vesna) — the crown cracking, petals and green shoots bursting through her ash-grey robes as color floods upward. A young Indian woman in a saffron haori (Devika) tends the rite-fire with Emberkit's coal at its heart. Snowmelt and blossom in one frame. The kanji 災 shattering.",
        texts: [
          { kind: "speech", speaker: "Keepers (chorus)", ja: "冬を流し、春を呼ぶ——ヴェスナ！　ヴェスナ！", romaji: "Fuyu o nagashi, haru o yobu—— Vesuna! Vesuna!", en: "Carry winter out, call the spring in — VESNA! VESNA!" },
          { kind: "speech", speaker: "Vesna", ja: "……ああ。村々が黙って、私は「災い」になった。もう一度……名前で呼ばれた。", romaji: "……Aa. Muramura ga damatte, watashi wa \"wazawai\" ni natta. Mou ichido…… namae de yobareta.", en: "…Ah. The villages went silent, and I became 'calamity.' And now… I am called by name again." },
        ],
      },
      {
        id: "ch12_p4",
        aspect: "spread",
        beat: "The descent into the Unwritten Sea: a whiteness where speech bubbles cannot form. Bruna — chosen steel that means every word — carries the naming-brush where no flesh survives; Meridian wakes beneath them, refusing to let the ground be unmeant; Sir Pebble guards the door that matters.",
        cast: ["ne_titan", "ti_founder", "ch_knight"],
        artPrompt:
          "Full-color manga spread: inside the Unwritten Sea — a horizonless white cold where color and outline fray at the edges of everything. Striding through it, a gleaming chrome full-conversion cyborg woman (Bruna) carrying a great calligraphy brush across her back like a lance, frost feathering her steel. Beneath the whiteness, half-emerged like a mountain waking, a colossal stone guardian (Meridian) braces the ground on its shoulders, keeping a floor of solid rock under the walkers. Far behind at the door, absurd and unbudging, a tiny cardboard knight (Sir Pebble) stands guard at the threshold. The kanji 鋼 on Bruna's shoulder; 礎 across Meridian's brow.",
        texts: [
          { kind: "speech", speaker: "Bruna", ja: "元の体は一グラムも残ってない。それでも私は、全部の言葉を本気で言う。——鋼は、自分の名前を自分で選んだ。", romaji: "Moto no karada wa ichi-guramu mo nokottenai. Soredemo watashi wa, zenbu no kotoba o honki de iu. —— Hagane wa, jibun no namae o jibun de eranda.", en: "Not one gram of my first body remains. And still I mean every word I say. Steel chose its own name." },
          { kind: "speech", speaker: "Meridian", ja: "地ヲ、意味カラ、剥ガサセヌ。", romaji: "Chi o, imi kara, hagasasenu.", en: "THE GROUND. WILL NOT. BE UNMEANT." },
          { kind: "speech", speaker: "Sir Pebble", ja: "この扉、通行止めである！　主に、こわいから！　だが退かぬ！", romaji: "Kono tobira, tsuukoudome de aru! Omo ni, kowai kara! Daga shirizokanu!", en: "This door is CLOSED! Mostly because I'm terrified! And yet I hold!" },
        ],
      },
      {
        id: "ch12_p5",
        aspect: "landscape",
        beat: "Mu manifests: a person-shaped absence quoting the party's own dead — its only voice. Pip hears its underneath: not hatred, the pain of an unmeant word, 1,200 years long. Rafa waves hello. Mochi eats a quotation and is briefly the most dangerous being alive.",
        cast: ["nc_mu", "he_anya", "po_satoru", "ch_mocha"],
        artPrompt:
          "Full-color manga panel: in the white sea, a person-shaped absence — a human silhouette of pure blank where the world's ink is missing (Mu) — surrounded by drifting fragments of quoted speech in the handwriting of the dead. Facing it at arm's length: a tiny German girl in an oversized coat (Pip) with tears running, a small Oaxacan boy (Rafa) raising a cheerful wave, and a round snack gremlin (Mochi) mid-CHOMP on a floating grey quotation, sparks flying from its teeth. The absence has tilted its head at the wave — learning the gesture.",
        texts: [
          { kind: "speech", speaker: "Mu", ja: "《だってよ、あの島の酒は》《よく帰ったね》《いいね。フォロー。》", romaji: "《Datte yo, ano shima no sake wa》《yoku kaetta ne》《ii ne. Forou.》", en: "'The rum on that island—' 'Welcome home.' 'Like. Follow.'" },
          { kind: "speech", speaker: "Pip", ja: "きこえた……この子の下は、憎しみじゃない。千二百年ぶんの「誰かに意味されたい」だ。", romaji: "Kikoeta…… kono ko no shita wa, nikushimi ja nai. Sen-nihyaku-nen bun no \"dareka ni imi saretai\" da.", en: "I hear it… underneath, it isn't hate. It's twelve hundred years of 'please, someone, mean me.'" },
          { kind: "speech", speaker: "Rafa", ja: "はじめまして！", romaji: "Hajimemashite!", en: "Nice to meet you!" },
        ],
      },
      {
        id: "ch12_p6",
        aspect: "spread",
        beat: "The ring of sixty burning kanji around the person-shaped whiteness — every family voicing its glyph, a perimeter of meant words per Rule 1; Seraphine verifies the blank-but-entered register line; Nibbles roars the first syllable; Bao's sword is summoned home mid-battle, and he smiles.",
        cast: ["lu_queen", "ch_dragon", "vo_zoro"],
        artPrompt:
          "Full-color manga spread: a vast ring of sixty blazing kanji hanging in the white void, each glyph a different color, encircling the small person-shaped absence at the center. Above, an ethereal moon queen (Seraphine) holds open an enormous silver register whose pages are columns of names — one line glowing, entered but blank. At the ring's edge a palm-sized dragon (Nibbles) rears back and ROARS a syllable bigger than itself, and a Vietnamese swordsman (Bao) opens his hand as his jian rises out of it into a golden turtle-shaped light, and he is smiling. The kanji 后 on the register's clasp.",
        texts: [
          { kind: "speech", speaker: "Seraphine", ja: "月の帳に、記載あり。行は——空白。つまり名は「無い」のではない。「未だ書かれていない」。", romaji: "Tsuki no chou ni, kisai ari. Gyou wa—— kuuhaku. Tsumari na wa \"nai\" no de wa nai. \"Imada kakarete inai\".", en: "The lunar register holds an entry. The line is blank. Its name is not missing — it is not yet written." },
          { kind: "speech", speaker: "Bao", ja: "刀が還る——戦が、終わるんだ。", romaji: "Katana ga kaeru—— ikusa ga, owaru n da.", en: "The sword is going home — the war is ending." },
          { kind: "sfx", ja: "ガアアッ！", romaji: "gaaatt!", en: "RAAAH!" },
        ],
      },
      {
        id: "ch12_p7",
        aspect: "spread",
        beat: "THE NAMING — Sen, with the Pattern's slot, the comet's testimony, the register's blank line and the court's verdict, writes the name with Bruna's brush: 間, the pause between the beats of Shiva's drum — the first word re-learned from ancient light, re-meant by a living mind, Vāc's breath moving through a learner's hand.",
        cast: ["nc_mu", "ne_titan", "nc_tsuru"],
        artPrompt:
          "Full-color manga spread: at the center of the white sea, a slight teen in a dark windbreaker (Sen, seen from behind, face never shown) grips the great calligraphy brush handed down by the chrome cyborg (Bruna) kneeling as a brush-rest. Sen writes into a floating bracket of light: four inset micro-panels across the top show the stroke order of the kanji 間 being written — one, two, three, the final stroke landing. As ink of dawn-color floods the whiteness, immense and translucent behind Sen rise two after-images: a dancing four-armed figure with a small hourglass drum mid-beat, and a radiant goddess of speech guiding the brush-hand — both echoed by tiny ochre dancers in the Bhimbetka rock art. The person-shaped absence fills in, line by line, like a drawing being completed. An origami crane rides the brush's tip.",
        texts: [
          { kind: "speech", speaker: "Sen", ja: "君は「間」だ。言葉と言葉のあいだ。太鼓の一打と一打の、あいだの静けさ。——ぼくは本気で、そう呼ぶ。", romaji: "Kimi wa \"ma\" da. Kotoba to kotoba no aida. Taiko no ichida to ichida no, aida no shizukesa. —— Boku wa honki de, sou yobu.", en: "You are MA — 間. The space between words. The stillness between one drumbeat and the next. And I mean it." },
          { kind: "caption", ja: "拍と拍の間があってこそ、律動は生まれる。シヴァの太鼓は休符を取り戻した——最後の語彙が、世界を救った。", romaji: "Haku to haku no ma ga atte koso, ritsudou wa umareru. Shiva no taiko wa kyuufu o torimodoshita—— saigo no goi ga, sekai o sukutta.", en: "Only the pause between beats makes rhythm. Shiva's drum got its rest-note back — and the saga's final vocabulary word saved the world." },
        ],
      },
      {
        id: "ch12_p8",
        aspect: "landscape",
        beat: "EPILOGUE — the campfire circle at Bhimbetka: Mu, small now, keeper of 無, seated at the fire's edge as the silence between everyone's words; Minjae's notebook enters Seraphine's register; Devika's flame burns ordinary orange; far past the comet's orbit, one strand hums in no known tongue.",
        cast: ["nc_mu", "sh_rookie", "lu_queen"],
        artPrompt:
          "Full-color manga panel, warm dusk: a campfire among the Bhimbetka rocks, the whole vast party sprawled in easy exhaustion — soup passing, small laughter, bandages, Emberkit's coal returned to an ordinary orange fire. At the circle's edge sits a small, quiet, person-shaped figure now drawn in soft complete ink (Mu), hands around a cup, present in every pause of the conversation. A Korean rookie (Minjae) hands his battered notebook up to an ethereal moon queen (Seraphine), who shelves it in a sliver of silver light. In the far top corner of the sky, one distant thread trembles with an unfamiliar shimmer. The kanji 無 small and calm on Mu's cup.",
        texts: [
          { kind: "caption", ja: "静寂は消えず、言葉の一部になった。消された言葉は学び直されるまで戻らない——世界の修繕は、あなたの復習と同じ速さで進む。", romaji: "Shijima wa kiezu, kotoba no ichibu ni natta. Kesareta kotoba wa manabinaosareru made modoranai—— sekai no shuuzen wa, anata no fukushuu to onaji hayasa de susumu.", en: "The silence became a part of speech. Erased words stay lost until relearned — the world's repair moves exactly as fast as your review." },
          { kind: "speech", speaker: "Mu", ja: "……間。……ぼくの、名前。", romaji: "……Ma. ……Boku no, namae.", en: "…Ma. …My name." },
          { kind: "caption", ja: "——彗星の軌道の遥か外で、一本の糸が、誰も知らない言葉で震えていた。", romaji: "—— Suisei no kidou no haruka soto de, ippon no ito ga, dare mo shiranai kotoba de furuete ita.", en: "— And far past the comet's orbit, one strand hummed in a tongue no one knew." },
        ],
      },
    ],
  },
];

export const CHAPTERS: MangaChapter[] = [CH1, ...CHAPTERS_2_12];

export function chapterById(id: string): MangaChapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

/** The panel where a given card debuts (first meaningful appearance). */
export function debutPanelForCard(cardId: string): { chapter: MangaChapter; panelId: string } | null {
  for (const ch of CHAPTERS) {
    if (!ch.debutCardIds.includes(cardId)) continue;
    const panel = ch.panels.find((p) => p.cast.includes(cardId)) ?? ch.panels[0];
    return { chapter: ch, panelId: panel.id };
  }
  return null;
}
