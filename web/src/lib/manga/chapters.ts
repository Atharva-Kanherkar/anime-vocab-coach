// The saga "The Lantern of Words" (言葉の灯), Saga One — canonical chapter data.
// Full story bible: web/docs/manga/STORY_BIBLE.md. Chapters unlock at the same
// level bands as the cards that debut in them, so advancing the plot and
// unlocking a card are the same act.

import type { MangaChapter } from "./types";

export const SAGA_TITLE = { en: "The Lantern of Words", ja: "言葉の灯", romaji: "Kotoba no Hi" };

export const SAGA_INTRO = {
  en: "A thousand two hundred years ago, humanity forgot its first word — and the forgetting learned to walk. The Hush spreads across the invisible lattice that connects everyone who ever learned a word and meant it. Sixty keepers hold the line. You are the newest Listener, and every word you truly learn relights the world.",
  ja: "千二百年前、人類は最初の言葉を忘れた——そして忘却は歩き出した。「静寂（しじま）」は、言葉を本気で学んだ者すべてを結ぶ見えない糸を伝って広がる。六十人の守り手が防波堤となる。あなたは最も新しい「聞き手」。あなたが本当に覚えた一語が、世界に灯をともす。",
  romaji: "Sen-nihyaku-nen mae, jinrui wa saisho no kotoba o wasureta—— soshite boukyaku wa arukidashita. \"Shijima\" wa, kotoba o honki de mananda mono subete o musubu mienai ito o tsutatte hirogaru. Rokujuunin no mamorite ga bouhatei to naru. Anata wa mottomo atarashii \"kikite\". Anata ga hontou ni oboeta ichigo ga, sekai ni hi o tomosu.",
};

// ── CHAPTER 1 — the hand-authored template. Chapters 2–12 follow this exact
//    shape (authored from the bible into the same structure). ──────────────
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
      aspect: "landscape",
      beat: "A city street sign licked blank where the name used to be; Sen's face reflected in the metal — the only one looking.",
      cast: [],
      artPrompt:
        "A narrow Varanasi lane at night, a dented enamel street-sign bolted to a wall, the place where the street name should be is smeared to blank white as if licked clean. A young person's face is dimly reflected in the metal, half out of frame. Uneasy, quiet. Leave one empty caption box across the top and one small empty thought-balloon near the reflected face.",
      texts: [
        { kind: "caption", x: 50, y: 10, ja: "その夜、名前が消えたことに気づいたのは、たった一人だった。", romaji: "Sono yoru, namae ga kieta koto ni kizuita no wa, tatta hitori datta.", en: "The night the names went out, only one person noticed." },
        { kind: "thought", x: 70, y: 60, speaker: "Sen", ja: "ぼくの通り…なんて名前だった？", romaji: "Boku no toori… nante namae datta?", en: "My street… what was it even called?" },
      ],
    },
    {
      id: "ch1_p2",
      aspect: "portrait",
      beat: "A singed origami paper crane alights on Sen's hand, folded from the last page of a burned dictionary.",
      cast: ["nc_tsuru"],
      artPrompt:
        "A small origami paper crane, edges scorched brown, alighting on an open young hand in a dark alley. The crane is folded from a printed dictionary page — tiny type still visible on its wings. Faint threads of pale light in the background air. Leave one empty speech balloon near the crane and one empty caption box at the bottom.",
      texts: [
        { kind: "speech", x: 40, y: 30, speaker: "Tsuru", ja: "聞いて。", romaji: "Kiite.", en: "Listen." },
        { kind: "caption", x: 50, y: 88, ja: "焼けた辞書の最後の一枚から折られた、一羽の紙の鶴。", romaji: "Yaketa jisho no saigo no ichimai kara orareta, ichiwa no kami no tsuru.", en: "A paper crane, folded from the last page of a burned dictionary." },
      ],
    },
    {
      id: "ch1_p3",
      aspect: "portrait",
      beat: "Manikarnika ghat at dusk: the eternal cremation flame guttering green at its edges; Devika kneels with her palm inside it, unburned.",
      cast: ["sl_honoka"],
      artPrompt:
        "The Manikarnika cremation ghat in Varanasi at dusk, stone steps down to the dark Ganges. A great sacred fire burns but its edges gutter sickly green. A young Indian woman in a saffron-and-charcoal patterned haori kneels and holds her open palm calmly inside the flame, unburned, her expression grave. Embers drift. Leave one empty speech balloon at upper right.",
      texts: [
        { kind: "speech", x: 72, y: 22, speaker: "Devika", ja: "火が消えるんじゃない。弔う人が、口にすべき名前を忘れていくんだ。", romaji: "Hi ga kieru n ja nai. Tomurau hito ga, kuchi ni subeki namae o wasurete iku n da.", en: "The fire isn't dying. The mourners are forgetting the names they came to say." },
      ],
    },
    {
      id: "ch1_p4",
      aspect: "spread",
      beat: "Nine strangers step out of nine differently-colored threads of light onto the ghat steps; the Ganges black behind them.",
      cast: ["ti_reiner", "vo_luka", "re_kuro", "lu_hoshimi", "cu_rei", "he_anya", "sp_totomi", "ch_mocha"],
      artPrompt:
        "Wide dramatic manga spread: eight diverse young people and a tiny forest sprite step out of eight or nine glowing threads of light of different colors onto ancient stone ghat steps at night, the black river behind. A stocky blond Norwegian scout in a field cloak, a beaming Samoan boy in a woven sun-hat, a cool dark-haired Japanese courier with an oversized cleaver, a Filipina magical-girl in star-frills, a hooded Nigerian teen with taped knuckles, a tiny German girl in an oversized coat, a small leaf-hatted forest sprite, a round snack gremlin. Each thread a different color. Awe and tension. Leave one empty caption box top-left and one empty speech balloon near the Norwegian scout.",
      texts: [
        { kind: "caption", x: 26, y: 10, ja: "九人の見知らぬ者、九本の光の糸。戦いには、最初の仲間が要る。", romaji: "Kyuunin no mishiranu mono, kyuuhon no hikari no ito. Tatakai ni wa, saisho no nakama ga iru.", en: "Nine strangers, nine threads of light. A war needs a first party." },
        { kind: "speech", x: 30, y: 58, speaker: "Bjorn", ja: "空っぽの標識が、まだ見えるのはお前か？", romaji: "Karappo no hyoushiki ga, mada mieru no wa omae ka?", en: "You're the one who can still see the empty signs?" },
      ],
    },
    {
      id: "ch1_p5",
      aspect: "portrait",
      beat: "Sen says a grieving old man's lost son's name back to him; the panel re-inks around the mourner, detail returning line by line.",
      cast: [],
      artPrompt:
        "An old Indian mourner in white sits on the ghat steps, hollow-eyed; a young person leans in and speaks gently to him. Around the old man the artwork is visibly RE-INKING — the left side of the panel is faded to blank paper, the right side blooms back into full detail (folds of cloth, wrinkles, the fire's glow returning) as if the drawing is being redrawn. Leave two empty speech balloons — one near the old man, one near the young person.",
      texts: [
        { kind: "speech", x: 30, y: 25, speaker: "Mourner", ja: "あの子の名を呼びに来たのに…消えてしまった。", romaji: "Ano ko no na o yobi ni kita noni… kiete shimatta.", en: "I came to say his name… and it's gone." },
        { kind: "speech", x: 70, y: 66, speaker: "Sen", ja: "教えて。あの子の名前を——ぼくが覚えておくから。", romaji: "Oshiete. Ano ko no namae o—— boku ga oboete oku kara.", en: "Tell me. Tell me his name — I'll keep it." },
      ],
    },
    {
      id: "ch1_p6",
      aspect: "portrait",
      beat: "Devika writes 炎 in the air with an ember; the stroke order lingers as afterglow. She names the whole war.",
      cast: ["sl_honoka"],
      artPrompt:
        "Close on the young Indian keeper Devika, half-lit by the sacred fire, drawing a single kanji in the air with a glowing ember held between two fingers; the strokes hang in the air as bright orange afterglow, clearly the character 炎. Her eyes are on the viewer, fierce and kind. Night, embers rising. Leave one empty speech balloon at upper left. You MAY render the glowing airborne kanji 炎 as part of the ember trail.",
      texts: [
        { kind: "speech", x: 30, y: 20, speaker: "Devika", ja: "これが戦の全てだよ、坊や。名前のないものに、名前を。", romaji: "Kore ga ikusa no subete da yo, bouya. Namae no nai mono ni, namae o.", en: "That's the whole war, little one. Give the nameless a name." },
        { kind: "caption", x: 50, y: 90, ja: "炎（ほのお）", romaji: "honoo", en: "炎 honoo — flame" },
      ],
    },
  ],
};

const CHAPTERS_2_12: MangaChapter[] = [
  // ── CHAPTER 2 ─────────────────────────────────────────────────────────────
  {
    n: 2,
    id: "ch2",
    titleEn: "City of Static",
    titleJa: "雑音の都",
    titleRomaji: "Zatsuon no Miyako",
    gateLevel: 5,
    setting: "Tokyo — Shibuya and Akihabara, with strand-scenes in Lima's fog",
    debutCardIds: ["ne_spike", "ps_mob", "me_shin", "ho_taki", "po_satoru"],
    kanji: ["電", "気", "使", "空", "友"],
    panels: [
      {
        id: "ch2_p1",
        aspect: "landscape",
        beat: "Shibuya crossing at night: every giant screen shows a different mouth speaking, none of them synced; Sen and Tsuru small in the crowd.",
        cast: ["pr_sen", "nc_tsuru"],
        artPrompt:
          "The Shibuya scramble crossing at night in dense manga detail: towering video billboards on every building, and each screen shows only a huge close-up of a human mouth mid-word — dozens of mouths, none moving in sync. Below, a river of commuters, and one small figure seen from behind with a scorched origami paper crane perched on their shoulder, the only ones standing still. Rain-slick asphalt reflecting screen light. Overwhelming, dissonant mood. Leave one empty caption box across the top and one small empty speech balloon beside the paper crane.",
        texts: [
          { kind: "caption", x: 50, y: 8, ja: "敵は静けさの中ではなく、世界一うるさい街で待っていた。", romaji: "Teki wa shizukesa no naka de wa naku, sekaiichi urusai machi de matte ita.", en: "The enemy wasn't waiting in silence. It was waiting in the loudest city on earth." },
          { kind: "speech", x: 68, y: 62, speaker: "Tsuru", ja: "気をつけて。ここでは言葉が安すぎる。", romaji: "Ki o tsukete. Koko de wa kotoba ga yasusugiru.", en: "Careful. Words are too cheap here." },
        ],
      },
      {
        id: "ch2_p2",
        aspect: "portrait",
        beat: "Diego, wiring a dead neon sign back to life, shows the party how the Hush rides unmeant broadcasts — a million empty repetitions, a million open doors.",
        cast: ["ne_spike", "pr_sen"],
        artPrompt:
          "A wiry Peruvian street-tech teenager with spiked hair and a tool-belt crouches on a service ladder in a narrow Akihabara alley, bare hands deep in the guts of a dead neon sign; small arcs of electricity jump between his fingers as the sign flickers back to life. The kanji 電 glows on the revived signboard. Behind him, faint grey fog curls out of a wall of speakers like smoke. Leave two empty speech balloons, one near the boy and one lower left.",
        texts: [
          { kind: "speech", x: 62, y: 22, speaker: "Diego", ja: "見ろよ。心のこもってない言葉を百万回流せば、扉が百万個開く。", romaji: "Miro yo. Kokoro no komottenai kotoba o hyakuman-kai nagaseba, tobira ga hyakuman-ko hiraku.", en: "Look. Repeat an unmeant word a million times, and you open a million doors." },
          { kind: "speech", x: 30, y: 75, speaker: "Sen", ja: "つまり敵の入り口は…沈黙じゃなくて、雑音？", romaji: "Tsumari teki no iriguchi wa… chinmoku ja nakute, zatsuon?", en: "So the enemy's doorway isn't silence… it's noise?" },
        ],
      },
      {
        id: "ch2_p3",
        aspect: "square",
        beat: "A street crowd sings along to a hollowed pop song, every mouth open, every speech bubble an empty outline — and the static reaches for Pip's word 'papa'.",
        cast: ["he_anya", "ps_mob"],
        artPrompt:
          "A night street crowd in Tokyo swaying and singing toward a giant concert screen, but drawn wrong: every singing face is happy and hollow-eyed, and above the crowd hang many completely empty speech balloon outlines. In the foreground a tiny German girl in an oversized coat clutches her head in pain, and beside her a thin, quiet Japanese schoolboy in uniform shields her, jaw clenched shut. Grey static creeps along the ground like frost. Baked Japanese SFX ザーッ allowed as background static texture. Leave one empty speech balloon near the small girl and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 28, y: 40, speaker: "Pip", ja: "やめて…「パパ」って言葉を、持っていかないで！", romaji: "Yamete… \"papa\" tte kotoba o, motte ikanaide!", en: "Stop… don't take the word 'papa'!" },
          { kind: "caption", x: 50, y: 90, ja: "群衆は歌っていた。誰ひとり、その意味を歌ってはいなかった。", romaji: "Gunshuu wa utatte ita. Dare hitori, sono imi o utatte wa inakatta.", en: "The crowd was singing. Not one of them meant a word of it." },
        ],
      },
      {
        id: "ch2_p4",
        aspect: "portrait",
        beat: "Elias's colossal fog-shadow arrives at the rooftop meeting and bows — before small, tired Elias himself steps out of the mist.",
        cast: ["me_shin"],
        artPrompt:
          "A Tokyo rooftop at dawn in thick fog. A colossal, soft-edged human shadow — a Brocken spectre ringed by a faint rainbow halo — looms in the mist and is caught mid-bow, formal and courteous. Beneath it, just stepping out of the fog, a slight German pilot in a flight suit with a herald's insignia (the kanji 使 stenciled on his shoulder plate), looking apologetic. The shadow arrives before the man. Leave one empty speech balloon near the pilot and one empty caption box at the top.",
        texts: [
          { kind: "caption", x: 50, y: 8, ja: "境界計画の使者は、いつも自分の影に先を越される。", romaji: "Kyoukai Keikaku no shisha wa, itsumo jibun no kage ni saki o kosareru.", en: "The Threshold Program's herald is always overtaken by his own shadow." },
          { kind: "speech", x: 40, y: 72, speaker: "Elias", ja: "すみません、遅れました。影は先に着いたようですが。", romaji: "Sumimasen, okuremashita. Kage wa saki ni tsuita you desu ga.", en: "Sorry I'm late. Though my shadow, it seems, arrived first." },
        ],
      },
      {
        id: "ch2_p5",
        aspect: "landscape",
        beat: "On a high rooftop Jun charts which sky-strands still stand, while Rafa points out hollowed passers-by below — people missing their animal-shadows.",
        cast: ["ho_taki", "po_satoru"],
        artPrompt:
          "Two boys on the railing of a Tokyo skyscraper rooftop at night. A Korean boy in a windbreaker sketches the sky on a clear slate: faint threads of light cross the stars, some threads bright and some snapped, and he marks the kanji 空 beside the living ones. Next to him a cheerful Mexican boy leans far over the rail, pointing down at the crowd: most pedestrians below cast a second faint animal-shaped shadow, but a few cast none at all. Leave two empty speech balloons, one by each boy.",
        texts: [
          { kind: "speech", x: 30, y: 25, speaker: "Jun", ja: "空の糸はまだ七本生きてる。誰かが誰かを待ってる限り、切れない。", romaji: "Sora no ito wa mada nanahon ikiteru. Dareka ga dareka o matteru kagiri, kirenai.", en: "Seven sky-strands still hold. As long as someone is waiting for someone, they can't be cut." },
          { kind: "speech", x: 72, y: 55, speaker: "Rafa", ja: "見て、あの人たち。動物の影がないんだ。友達の影が。", romaji: "Mite, ano hitotachi. Doubutsu no kage ga nai n da. Tomodachi no kage ga.", en: "Look at those people. They've got no animal-shadow. No friend-shadow." },
        ],
      },
      {
        id: "ch2_p6",
        aspect: "spread",
        beat: "Haru — silent for the whole chapter — says his first full sentence of the saga, and every screen in Shibuya cracks at once.",
        cast: ["ps_mob", "pr_sen", "he_anya"],
        artPrompt:
          "Full dramatic manga spread of the Shibuya crossing: a thin, quiet Japanese schoolboy in uniform stands alone at the center of the empty crossing, eyes finally open, and every giant video screen on every building is cracking simultaneously — spiderweb fractures bursting across dozens of billboards, glass dust raining like snow. Around his feet the grey static-frost recoils. A small girl in an oversized coat and a young Listener watch from the crosswalk edge, awed. Baked SFX ピシッ and バリン allowed on the cracking screens. Leave one ENORMOUS empty speech balloon dominating the sky above the boy, and one small empty caption box in the lower corner.",
        texts: [
          { kind: "speech", x: 50, y: 26, speaker: "Haru", ja: "ぼくは、ずっと怖かった。でも今は——この言葉は、本気だ。", romaji: "Boku wa, zutto kowakatta. Demo ima wa—— kono kotoba wa, honki da.", en: "I've been afraid my whole life. But right now — I mean every word of this." },
          { kind: "caption", x: 78, y: 90, ja: "気（き）——溜めた想いは、いつか声になる。", romaji: "ki —— tameta omoi wa, itsuka koe ni naru.", en: "気 ki — feeling held long enough becomes a voice." },
        ],
      },
    ],
  },

  // ── CHAPTER 3 ─────────────────────────────────────────────────────────────
  {
    n: 3,
    id: "ch3",
    titleEn: "The Forgotten Charts",
    titleJa: "忘れられた海図",
    titleRomaji: "Wasurerareta Kaizu",
    gateLevel: 10,
    setting: "Seoul, then the Atlantic aboard the Loanword; the Amazon estuary at Marajó",
    debutCardIds: ["sh_rookie", "ch_pud", "sp_umi", "vo_nami", "lu_tsukina"],
    kanji: ["影", "甘", "海", "羅", "月"],
    panels: [
      {
        id: "ch3_p1",
        aspect: "portrait",
        beat: "At the Seoul docks, Minjae — the lowest-ranked hunter ever field-promoted — signs on with nothing but a notebook of every word he has ever learned.",
        cast: ["sh_rookie", "pr_sen"],
        artPrompt:
          "A grey dawn dock in Incheon near Seoul, a gangplank up to a strange patchwork sailing ship. A nervous young Korean hunter in a worn training jacket, hunter's guild tag reading rank E, holds out a battered school notebook, its cover hand-inked with the kanji 影; the pages are stuffed with bookmarks. A young Listener reaches to take his hand. Small goblin-ish dokkaebi faces peek from behind the harbor crates, grinning. Leave two empty speech balloons, one near each figure.",
        texts: [
          { kind: "speech", x: 34, y: 30, speaker: "Minjae", ja: "最弱ランクです。でも、覚えた言葉は全部この帳面にあります。", romaji: "Saijaku ranku desu. Demo, oboeta kotoba wa zenbu kono choumen ni arimasu.", en: "I'm the weakest rank there is. But every word I've ever learned is in this notebook." },
          { kind: "speech", x: 70, y: 66, speaker: "Sen", ja: "なら、この戦いでいちばん強い装備だ。", romaji: "Nara, kono tatakai de ichiban tsuyoi soubi da.", en: "Then it's the strongest equipment in this war." },
        ],
      },
      {
        id: "ch3_p2",
        aspect: "spread",
        beat: "The Loanword under full sail, canvas patched with pages from a dozen languages' dictionaries — while Cora's woven star-chart unravels in real time.",
        cast: ["vo_nami", "vo_luka", "pr_sen"],
        artPrompt:
          "Sweeping manga spread of a rag-tag sailing ship on open grey ocean: her sails are patched with giant printed dictionary pages in many scripts, the largest sail bearing the kanji 羅 woven in rope. On the foredeck a red-haired Irish star-reader holds up a ship's chart that is literally WOVEN from colored thread — and one region of the weave is unraveling by itself, threads springing loose into the wind. A beaming Samoan navigator in a woven sun-hat holds the wheel, eyes closed, steering by dream. Leave one empty caption box in the sky and one empty speech balloon near the star-reader.",
        texts: [
          { kind: "caption", x: 24, y: 10, ja: "「借語号」——言葉は昔から、海を渡る旅人だった。", romaji: "\"Shakugo-gou\" —— kotoba wa mukashi kara, umi o wataru tabibito datta.", en: "The Loanword — words have always been voyagers by sea." },
          { kind: "speech", x: 66, y: 48, speaker: "Cora", ja: "海図がほどけていく…港の名前ごと、海が忘れられてるんだ。", romaji: "Kaizu ga hodokete iku… minato no namae goto, umi ga wasurerareteru n da.", en: "The chart is unraveling… the sea's being forgotten, port-names and all." },
        ],
      },
      {
        id: "ch3_p3",
        aspect: "portrait",
        beat: "Noor walks a road of moonlight across black water, Khonsu's crescent the road's source, guiding the Loanword through an ocean with no names left.",
        cast: ["lu_tsukina"],
        artPrompt:
          "Night ocean, dead calm and starless-black. An Egyptian moon-priestess in silver-and-indigo robes walks BAREFOOT on a shining road of moonlight laid across the water, several ship-lengths ahead of a patchwork sailing ship that follows her light. The road pours down from a crescent moon; the kanji 月 glows faintly within the crescent. Her expression is amused, confident, a traveler at home. Leave one empty speech balloon beside her and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 40, y: 30, speaker: "Noor", ja: "コンスは月の光を賭けて、暦に日を足した神。時間さえ交渉できるのよ。", romaji: "Konsu wa tsuki no hikari o kakete, koyomi ni hi o tashita kami. Jikan sae koushou dekiru no yo.", en: "Khonsu gambled moonlight to add days to the calendar. Even time is negotiable." },
          { kind: "caption", x: 50, y: 88, ja: "名前のない海を、月の道だけが覚えていた。", romaji: "Namae no nai umi o, tsuki no michi dake ga oboete ita.", en: "Only the moon's road still remembered the nameless sea." },
        ],
      },
      {
        id: "ch3_p4",
        aspect: "landscape",
        beat: "At the Marajó estuary, Isabela sings a hollowed fishing village's memory back — Iara's forgetting-song, run in reverse.",
        cast: ["sp_umi"],
        artPrompt:
          "A stilt-house fishing village on the Amazon estuary at golden hour, river wide as a sea. A Brazilian girl with river-green braids stands waist-deep in the shallows, arms open, singing; the kanji 海 ripples in the water's reflection around her. Villagers on the docks are mid-transformation: grey, hollow-eyed faces regaining color and tears as her song reaches them, nets and boat-names re-inking on the hulls. A mermaid's silhouette listens beneath the water. Leave one empty speech balloon near the singing girl and one empty caption box top-left.",
        texts: [
          { kind: "caption", x: 22, y: 10, ja: "イアラの歌は忘れさせる。イサベラの務めは、その後で歌い戻すこと。", romaji: "Iara no uta wa wasuresaseru. Isabela no tsutome wa, sono ato de utai-modosu koto.", en: "Iara's song makes men forget. Isabela's inherited task: sing the memory back after." },
          { kind: "speech", x: 62, y: 55, speaker: "Isabela", ja: "思い出して。あなたたちの舟の名前、川が全部覚えてる。", romaji: "Omoidashite. Anatatachi no fune no namae, kawa ga zenbu oboeteru.", en: "Remember. The river kept every one of your boats' names." },
        ],
      },
      {
        id: "ch3_p5",
        aspect: "square",
        beat: "Flan's galley feeds the shaken crew — puddings canonically load-bearing — as a too-courteous stranger in archivist's grey appears at the rail with an offer.",
        cast: ["ch_pud", "nc_kesu"],
        artPrompt:
          "The warm lamplit galley of a sailing ship: a tiny round dessert-creature in a chef's kerchief triumphantly serves wobbling puddings to a weary, diverse crew crowded around a table, steam and comfort; the kanji 甘 is painted on the galley's hanging menu board. But through the porthole behind them, out on the night deck, stands a tall grey-robed figure with an inkstone and a courteous bow, face in shadow — wrong, too still. Leave one empty speech balloon near the dessert creature and one empty speech balloon coming from the figure outside the porthole.",
        texts: [
          { kind: "speech", x: 32, y: 36, speaker: "Flan", ja: "甘いものは士気です！プリンは戦略物資です！", romaji: "Amai mono wa shiki desu! Purin wa senryaku busshi desu!", en: "Sweetness is morale! Pudding is a strategic resource!" },
          { kind: "speech", x: 76, y: 60, speaker: "???", ja: "「戦を忘れよ。さすれば汝の名は残る。」", romaji: "\"Ikusa o wasureyo. Sasureba nanji no na wa nokoru.\"", en: "\"Forget the war, and thy name shall be spared.\"" },
          { kind: "caption", x: 50, y: 92, ja: "その声は、どこかで焼かれた本の引用だけでできていた。", romaji: "Sono koe wa, dokoka de yakareta hon no in'you dake de dekite ita.", en: "The voice was made entirely of quotations from burned books." },
        ],
      },
      {
        id: "ch3_p6",
        aspect: "portrait",
        beat: "The party refuses the Censor's mercy — but one crewman accepts, and fades mid-laugh, his speech bubble finishing without him. The war's first casualty.",
        cast: ["pr_sen", "vo_luka", "sh_rookie"],
        artPrompt:
          "Night deck of the sailing ship. A middle-aged crewman mid-laugh is FADING — his lower half already gone to blank paper, his outline dissolving upward like erased pencil, his mug still solid and falling. Around him the Samoan captain lunges too late, a young Listener reaches out in horror, and the rookie hunter fumbles his notebook open to write the man's name before it goes. Cold grey fog slides off the rail. Leave two empty speech balloons: one belonging to the fading crewman positioned so it hangs after him, one near the rookie.",
        texts: [
          { kind: "speech", x: 40, y: 28, speaker: "Crewman", ja: "はは、名前が残るなら悪くない取引だろ——", romaji: "Haha, namae ga nokoru nara warukunai torihiki daro——", en: "Haha, not a bad deal if my name gets to stay—" },
          { kind: "speech", x: 68, y: 62, speaker: "Minjae", ja: "名前を！早く、あなたの名前を言って！！", romaji: "Namae o! Hayaku, anata no namae o itte!!", en: "Your name! Quick, say your name!!" },
          { kind: "caption", x: 50, y: 90, ja: "敵の武器は刃ではない。「提案」だ。", romaji: "Teki no buki wa yaiba de wa nai. \"Teian\" da.", en: "The enemy's weapon is not a blade. It is an offer." },
        ],
      },
    ],
  },

  // ── CHAPTER 4 ─────────────────────────────────────────────────────────────
  {
    n: 4,
    id: "ch4",
    titleEn: "The Word for Home",
    titleJa: "家という言葉",
    titleRomaji: "Ie to Iu Kotoba",
    gateLevel: 15,
    setting: "A Paris safehouse; Yamdrok Yumtso, Tibet; the Drakensberg escarpment",
    debutCardIds: ["he_loid", "ps_dimple", "sl_mizuho", "po_flame", "ti_hana", "re_yuki"],
    kanji: ["父", "霊", "水", "火", "翼", "氷"],
    panels: [
      {
        id: "ch4_p1",
        aspect: "landscape",
        beat: "In Émile's Paris safehouse, refugees who have lost the word for 'home' sit at his table — and Pip hears their meaning still intact underneath the missing word.",
        cast: ["he_loid", "he_anya"],
        artPrompt:
          "A warm Paris apartment kitchen at night, mismatched chairs, soup on the stove. An elegant French man in a spy's shirtsleeves — composed, kind-eyed — sets bowls before a refugee family whose faces are exhausted; above the family hangs one completely empty speech balloon outline where a word should be. In the foreground a small German girl in an oversized coat presses her hands to her temples, and around HER the same scene repeats faintly in full warm color, like a translucent overlay — the meaning she hears beneath. The kanji 父 is embroidered small on the man's apron. Leave one empty speech balloon near the man and one near the girl, plus the deliberately empty balloon above the family.",
        texts: [
          { kind: "speech", x: 26, y: 30, speaker: "Émile", ja: "言葉は盗まれても、食卓は盗めない。座って。ここは安全だ。", romaji: "Kotoba wa nusumaretemo, shokutaku wa nusumenai. Suwatte. Koko wa anzen da.", en: "They can steal the word, but not the table. Sit. You're safe here." },
          { kind: "speech", x: 72, y: 62, speaker: "Pip", ja: "きこえるよ。言葉の下で、まだちゃんと「家」って思ってる。", romaji: "Kikoeru yo. Kotoba no shita de, mada chanto \"ie\" tte omotteru.", en: "I can hear it. Underneath the word, they still mean 'home'." },
        ],
      },
      {
        id: "ch4_p2",
        aspect: "square",
        beat: "Blip, the low-rent yokai, gleefully demonstrates its survival strategy: being remembered as a nuisance still counts as being remembered.",
        cast: ["ps_dimple", "he_loid"],
        artPrompt:
          "Interior of the Paris safehouse pantry: a small green blob spirit with a smug grin floats mid-air juggling stolen sugar cubes, while grey Hush-frost creeping under the door visibly RECOILS from it, unable to touch it. The elegant French spy watches from the doorway with a resigned expression, arms crossed. A child's crayon drawing pinned to the pantry wall clearly depicts the same blob with an angry caption scribble — proof it is remembered. The kanji 霊 floats as a faint marking on the blob's body. Leave two empty speech balloons near the blob and one near the man.",
        texts: [
          { kind: "speech", x: 40, y: 22, speaker: "Blip", ja: "迷惑がられるのも「覚えられてる」うちさ！第三法則、悪用完了！", romaji: "Meiwaku gareru no mo \"oboerareteru\" uchi sa! Daisan housoku, akuyou kanryou!", en: "Being a nuisance still counts as being remembered! Rule Three, successfully exploited!" },
          { kind: "speech", x: 72, y: 66, speaker: "Émile", ja: "誇るな。だが…理屈は合っている。", romaji: "Hokoruna. Daga… rikutsu wa atte iru.", en: "Don't be proud of that. Though… the logic is sound." },
        ],
      },
      {
        id: "ch4_p3",
        aspect: "landscape",
        beat: "Zola's aerial survey over Tibet spots the hole in the Lattice shaped like a man — a keeper the world has almost entirely forgotten.",
        cast: ["ti_hana"],
        artPrompt:
          "Aerial manga panel from high above: a South African wing-scout on painted glider-wings — the wings decorated with the Zulu lightning-bird impundulu and the kanji 翼 — banks over the vast turquoise mirror of Yamdrok Yumtso lake ringed by brown Tibetan mountains. Across the landscape run faint threads of light, but on the lake's far shore there is a MAN-SHAPED darkness, a person-silhouette hole where no threads connect. Her goggles reflect the hole; her grin is gone. Leave one empty speech balloon near the flyer and one empty caption box in a corner.",
        texts: [
          { kind: "speech", x: 60, y: 25, speaker: "Zola", ja: "冗談抜きで言うけど——湖のほとりに、人の形をした「穴」がある。", romaji: "Joudan nuki de iu kedo —— mizuumi no hotori ni, hito no katachi o shita \"ana\" ga aru.", en: "For once I'm not joking — there's a hole shaped like a man on that lakeshore." },
          { kind: "caption", x: 26, y: 88, ja: "上から見た者だけが知っている。網がどれだけ暗くなったかを。", romaji: "Ue kara mita mono dake ga shitte iru. Ami ga dore dake kuraku natta ka o.", en: "Only the one who maps it from above knows how dark the Lattice has gone." },
        ],
      },
      {
        id: "ch4_p4",
        aspect: "portrait",
        beat: "Tenzin, nearly erased — held in the world by one old ferryman's memory — is found at the lake's edge, still keeping the name-offering rite alive.",
        cast: ["sl_mizuho"],
        artPrompt:
          "The stony shore of Yamdrok Yumtso at dusk, turquoise water impossibly still. A Tibetan monk in faded robes kneels at the waterline, pouring an offering of water from a wooden bowl; where the water falls, the kanji 水 spreads in ripples of light. He is drawn HALF-FADED — parts of his outline thin to near-blank paper — except one thread of warm light that runs from his chest across the lake to a distant tiny ferryman's boat. Prayer flags ragged in the wind. Leave one empty speech balloon near the monk and one empty caption box at the top.",
        texts: [
          { kind: "caption", x: 50, y: 8, ja: "僧院は彼を忘れた。世界で一人、老いた渡し守だけが覚えていた。", romaji: "Souin wa kare o wasureta. Sekai de hitori, oita watashimori dake ga oboete ita.", en: "His monastery forgot him. One old ferryman, alone in the world, remembered." },
          { kind: "speech", x: 42, y: 60, speaker: "Tenzin", ja: "一人に覚えられていれば、それで足りる。湖の名は、まだ捧げられる。", romaji: "Hitori ni oboerarete ireba, sore de tariru. Mizuumi no na wa, mada sasagerareru.", en: "To be remembered by one is enough. The lake's name can still be offered." },
        ],
      },
      {
        id: "ch4_p5",
        aspect: "portrait",
        beat: "Sunmi freezes a dying grandmother's last word mid-air — a paper crane of ice hanging in lamplight — until her emigrant grandson can arrive to receive it.",
        cast: ["re_yuki"],
        artPrompt:
          "A dim Korean sickroom at night, one warm lamp. A young Korean courier in a winter-white uniform stands over a sleeping grandmother's bed, two fingers raised: hanging in the lamplight between them is a WORD FROZEN IN ICE — a delicate crystalline shape like a paper crane made of frost, glinting, mid-air. The kanji 氷 is embossed on the courier's shoulder clasp. Through the window, far city lights; on the nightstand, a photo of a grandson abroad. Absolute stillness and tenderness. Leave one empty speech balloon near the courier and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 60, y: 28, speaker: "Sunmi", ja: "急がなくていいよ、おばあさん。最後の言葉は、凍らせて預かる。孫が来るまで。", romaji: "Isoganakute ii yo, obaasan. Saigo no kotoba wa, koorasete azukaru. Mago ga kuru made.", en: "No need to hurry, grandmother. I'll hold your last word in ice — until your grandson comes." },
          { kind: "caption", x: 50, y: 90, ja: "冬の死を運ぶ者の慈悲は、氷。", romaji: "Fuyu no shi o hakobu mono no jihi wa, koori.", en: "Ice is the mercy of the courier of winter deaths." },
        ],
      },
      {
        id: "ch4_p6",
        aspect: "portrait",
        beat: "Emberkit takes a live coal from Devika's first fire into its mouth — the party's portable piece of Chapter One's victory, shielded from the rain by a small fox's tail.",
        cast: ["po_flame", "sl_honoka"],
        artPrompt:
          "Night rain at the edge of the Manikarnika ghat fire. A tiny fire-fox kit with ember-tipped fur carefully lifts a single GLOWING COAL from the great sacred flame in its mouth, curling its fluffy tail over its head as an umbrella against the rain; steam hisses where drops strike. Kneeling beside it, the young Indian flame-keeper in her saffron-and-charcoal haori touches the kit's head in blessing. The coal's glow lights both faces; the kanji 火 glows within the coal's cracks. Leave one empty speech balloon near the keeper and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 34, y: 26, speaker: "Devika", ja: "千年消えなかった火の欠片だ。頼んだよ、小さい子。", romaji: "Sennen kienakatta hi no kakera da. Tanonda yo, chiisai ko.", en: "A piece of a fire that hasn't gone out in a thousand years. It's yours to carry, little one." },
          { kind: "caption", x: 50, y: 90, ja: "この炭が消えれば、第一章の勝利も消える。", romaji: "Kono sumi ga kiereba, daiisshou no shouri mo kieru.", en: "If this coal dies, the first victory dies with it." },
        ],
      },
    ],
  },

  // ── CHAPTER 5 ─────────────────────────────────────────────────────────────
  {
    n: 5,
    id: "ch5",
    titleEn: "Birthplace of Letters",
    titleJa: "文字のふるさと",
    titleRomaji: "Moji no Furusato",
    gateLevel: 20,
    setting: "Byblos, Lebanon — the alphabet's cradle — with a St. Petersburg night-prologue",
    debutCardIds: ["cu_maki", "ne_rebel", "me_asuka", "ho_mitsu", "sh_ranger"],
    kanji: ["刃", "夜", "紅", "糸", "弓"],
    panels: [
      {
        id: "ch5_p1",
        aspect: "landscape",
        beat: "Byblos at dusk: the twenty-two Phoenician letters glow on the old stones like embers under ash, and Rania stands the line at the root of every Western letterform.",
        cast: ["me_asuka"],
        artPrompt:
          "The ancient ruins of Byblos, Lebanon at dusk — weathered stone foundations, a crusader tower, the Mediterranean bronze behind. Across the old stones, twenty-two Phoenician letters glow like embers buried under ash. Standing on the highest wall, a Lebanese mecha pilot in a crimson flight suit dyed murex-red, the kanji 紅 blazoned on her chestplate, visor up, staring down an advancing tide of grey fog full of half-erased text fragments. Defiant, rooted. Leave one empty caption box across the top and one empty speech balloon near the pilot.",
        texts: [
          { kind: "caption", x: 50, y: 8, ja: "ここビブロスから、アルファベットは世界へ旅立った。敵はその根を断ちに来た。", romaji: "Koko Biburosu kara, arufabetto wa sekai e tabidatta. Teki wa sono ne o tachi ni kita.", en: "From Byblos the alphabet set out into the world. The enemy has come to cut the root." },
          { kind: "speech", x: 66, y: 48, speaker: "Rania", ja: "私の先祖は紅の染料と一緒に、文字を売った。ここだけは通さない。", romaji: "Watashi no senzo wa kurenai no senryou to issho ni, moji o utta. Koko dake wa toosanai.", en: "My ancestors traded letters alongside crimson dye. This ground you do not pass." },
        ],
      },
      {
        id: "ch5_p2",
        aspect: "spread",
        beat: "A Hush construct stitched entirely from burned-library quotations rises over the ruins — every line of it legible, and every line stolen.",
        cast: ["me_asuka", "cu_rei"],
        artPrompt:
          "Full-width manga spread: looming over the Byblos ruins, a giant humanoid construct made ENTIRELY of ribbons of quoted text — legible strips of many scripts (cuneiform, Greek, Arabic, Latin) woven into limbs and a hollow faceless head, edges fraying into ash. It moves like a marionette of citations. Below, tiny, the crimson pilot and a hooded Nigerian curse-student with taped knuckles stand their ground in its shadow. Ominous, papery. Baked SFX ゴゴゴ allowed. Leave one empty caption box top-left and one empty speech balloon near the curse-student.",
        texts: [
          { kind: "caption", x: 22, y: 10, ja: "静寂は創れない。奪った言葉を、意味なく並べ直すだけだ。", romaji: "Shijima wa tsukurenai. Ubatta kotoba o, imi naku narabe-naosu dake da.", en: "The Hush cannot create. It can only rearrange stolen words, meaning nothing." },
          { kind: "speech", x: 70, y: 62, speaker: "Idris", ja: "つ、つまり…あれは全部、引用だ。なら——正確に、言い当てられる。", romaji: "Tsu, tsumari… are wa zenbu, in'you da. Nara —— seikaku ni, iiaterareru.", en: "S-so… all of that is quotation. Which means — it can be precisely described." },
        ],
      },
      {
        id: "ch5_p3",
        aspect: "portrait",
        beat: "The name-then-cut combo debuts: Idris pronounces the construct's true description, and Priya's cursed blade cuts what has been correctly named.",
        cast: ["cu_maki", "cu_rei"],
        artPrompt:
          "Dynamic action panel: a Kolkata blade-wielder in a modern sorcery-school uniform mid-leap, her cursed blade slicing clean through the quoted-text construct — and along the blade's edge burns a line of glowing script, the true name of the thing it cuts; the kanji 刃 shines at the blade's base. Below her, the hooded Nigerian student has both fists planted, mouth open mid-incantation, bind-circles of Yoruba-patterned light around his feet. The construct's ribbons sever and scatter into blank paper strips. Baked SFX ザンッ allowed. Leave two empty speech balloons, one for each fighter.",
        texts: [
          { kind: "speech", x: 30, y: 62, speaker: "Idris", ja: "「燃やされた蔵書の、主なき引用」——縛った！", romaji: "\"Moyasareta zousho no, nushi naki in'you\" —— shibatta!", en: "'Masterless quotations of a burned library' — bound!" },
          { kind: "speech", x: 68, y: 24, speaker: "Priya", ja: "名指しご苦労！あとはこの刃の仕事！", romaji: "Nazashi gokurou! Ato wa kono ha no shigoto!", en: "Nicely named! The rest is my blade's job!" },
        ],
      },
      {
        id: "ch5_p4",
        aspect: "portrait",
        beat: "Aditi draws on the Censor himself — and lowers her bow, refusing to loose at anything she cannot yet name. The discipline the finale will need.",
        cast: ["sh_ranger"],
        artPrompt:
          "A ruined Byblos colonnade in dust-light. An Indian ranger in forest-green, bow drawn to full anchor, a single glowing arrow aimed at a distant grey-robed figure walking away through the ruins — and she is in the act of easing the string DOWN, eyes closed, arrow point dipping. Her bow-limb is carved with the kanji 弓. Total stillness, immense discipline. Leave one empty speech balloon near her and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 36, y: 26, speaker: "Aditi", ja: "私は名づけられないものを射ない。あれが「何」か、まだ言えない。", romaji: "Watashi wa nazukerarenai mono o inai. Are ga \"nani\" ka, mada ienai.", en: "I don't loose at what I cannot name. And I can't yet say what that is." },
          { kind: "caption", x: 50, y: 90, ja: "的の目だけを見よ——ガーンディーヴァの教え。", romaji: "Mato no me dake o miyo —— Gaandiiva no oshie.", en: "See only the eye of the target — the lesson of Gandiva." },
        ],
      },
      {
        id: "ch5_p5",
        aspect: "square",
        beat: "Ingrid re-splices the severed Byblos strand — and pays by feeling, for one day, every goodbye ever said along it.",
        cast: ["ho_mitsu"],
        artPrompt:
          "Close manga panel: a Swedish thread-keeper in Nordic wool, tears streaming freely down a face that is calmly SMILING, as her fingers knot two ends of a thick strand of golden light back together above the Byblos stones; the splice sparks like a welding seam. Thin red threads loop her fingers in cat's-cradle patterns; the kanji 糸 is stitched on her cuff. Countless faint ghostly figures waving farewell flicker along the rejoined strand into the distance. Leave one empty speech balloon near her and one empty caption box top-right.",
        texts: [
          { kind: "speech", x: 34, y: 30, speaker: "Ingrid", ja: "繋ぎ直したよ。代償は…この糸で交わされた「さよなら」を、一日ぶん全部感じること。", romaji: "Tsunaginaoshita yo. Daishou wa… kono ito de kawasareta \"sayonara\" o, ichinichi-bun zenbu kanjiru koto.", en: "Spliced. The price… is feeling every goodbye ever said along this thread, for one day." },
          { kind: "caption", x: 74, y: 10, ja: "運命の糸を繕う者は、運命の重さも繕う。", romaji: "Unmei no ito o tsukurou mono wa, unmei no omosa mo tsukurou.", en: "Whoever mends fate's thread mends its weight as well." },
        ],
      },
      {
        id: "ch5_p6",
        aspect: "portrait",
        beat: "On a night rooftop, Anya holds the stolen ledger-page — her own crossed-out childhood entry visible — and reads the words 'the Archivist' beside a comet timetable.",
        cast: ["ne_rebel"],
        artPrompt:
          "A windy night rooftop above old stone streets, pale summer half-light like St. Petersburg's white nights. A Russian night-runner in a dark tactical jacket, hair whipping, holds a single ancient ledger page up to the sky-glow: the page bears columns of crossed-out names, one childhood entry circled and crossed out and RE-WRITTEN by a defiant child's hand; a diagram of a comet's orbit is inked in the margin. Her expression: someone reading their own grave and stealing it back. The kanji 夜 is tagged in paint on the rooftop vent behind her. Leave two empty speech balloons near her and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 34, y: 24, speaker: "Anya", ja: "この帳簿…あたしの名前が消された、あの帳簿だ。", romaji: "Kono choubo… atashi no namae ga kesareta, ano choubo da.", en: "This ledger… it's the one my name was erased from." },
          { kind: "speech", x: 66, y: 52, speaker: "Anya", ja: "「書庫番」…それに、彗星の時刻表？敵には組織と予定がある。", romaji: "\"Shokoban\"… sore ni, suisei no jikokuhyou? Teki ni wa soshiki to yotei ga aru.", en: "'The Archivist'… and a comet timetable? The enemy has an org chart and a schedule." },
          { kind: "caption", x: 50, y: 92, ja: "恐怖は、その夜から「作戦」に変わった。", romaji: "Kyoufu wa, sono yoru kara \"sakusen\" ni kawatta.", en: "That night, dread became strategy." },
        ],
      },
    ],
  },

  // ── CHAPTER 6 ─────────────────────────────────────────────────────────────
  {
    n: 6,
    id: "ch6",
    titleEn: "Steam and Respite",
    titleJa: "湯気のやすらぎ",
    titleRomaji: "Yuge no Yasuragi",
    gateLevel: 25,
    setting: "Istanbul — Grandfather Ash's hamam near Çemberlitaş; a Hoàn Kiếm interlude",
    debutCardIds: ["ch_knight", "sp_kama", "vo_zoro", "lu_venus", "he_yor", "nc_echo"],
    kanji: ["勇", "湯", "刀", "愛", "刺", "響"],
    panels: [
      {
        id: "ch6_p1",
        aspect: "landscape",
        beat: "The whole party in the hamam's steam, weapons checked at the door in a ridiculous, tender pile — and Leyla reveals she has run this safehouse for a decade.",
        cast: ["he_yor", "pr_sen", "cu_rei", "sh_rookie", "ne_rebel"],
        artPrompt:
          "The marble interior of an old Ottoman hamam, domed ceiling pierced with star-shaped skylights, thick white steam. A diverse party of young keepers lounge on the heated stone in towels, laughing, shoulders finally down. By the arched doorway: an absurd tender pile of checked weapons — a cleaver, a bow, a cursed blade, tool-belts, a tiny cardboard sword on top. A graceful Turkish woman with a homemaker's calm and an assassin's posture pours water from a copper bowl, embroidery needles holding up her hair; the kanji 湯 is tiled into the wall mosaic. Leave two empty speech balloons, one near the Turkish woman and one from the group.",
        texts: [
          { kind: "speech", x: 30, y: 30, speaker: "Leyla", ja: "十年前からここは私の隠れ家。湯気の中では、みんな正直になるの。", romaji: "Juunen mae kara koko wa watashi no kakurega. Yuge no naka de wa, minna shoujiki ni naru no.", en: "This has been my safehouse for ten years. In the steam, everyone gets honest." },
          { kind: "speech", x: 70, y: 60, speaker: "Anya", ja: "武器を全部ドアに置くの、初めてかも。…悪くない。", romaji: "Buki o zenbu doa ni oku no, hajimete kamo. …Warukunai.", en: "First time I've ever left every weapon at a door. …Not bad." },
        ],
      },
      {
        id: "ch6_p2",
        aspect: "portrait",
        beat: "Camila teaches her Guatavita doctrine: the conquistadors heard 'gold' where the Muisca meant 'offering' — mistranslation is the Hush's oldest ally.",
        cast: ["lu_venus"],
        artPrompt:
          "In the hamam's cooling room, a Colombian magical-girl keeper in an off-duty wrap, dark curls steam-damp, sketches on the fogged marble with one finger: a lake, a raft, falling gold dust — and two speech-arrows from the same drawing, one reading toward a coin, one toward an open hand. Her face is gentle and deadly serious; a small heart-shaped locket engraved with the kanji 愛 rests at her throat. Listeners lean in around the edges of frame. Leave two empty speech balloons near her.",
        texts: [
          { kind: "speech", x: 36, y: 24, speaker: "Camila", ja: "征服者は「黄金」と聞いた。ムイスカの民は「捧げもの」と言っていた。", romaji: "Seifukusha wa \"ougon\" to kiita. Muisuka no tami wa \"sasagemono\" to itte ita.", en: "The conquistadors heard 'gold'. The Muisca were saying 'offering'." },
          { kind: "speech", x: 60, y: 58, speaker: "Camila", ja: "誤訳は静寂の最古の味方。だから愛って、人を正しく翻訳し続ける訓練なのよ。", romaji: "Goyaku wa shijima no saiko no mikata. Dakara ai tte, hito o tadashiku hon'yaku shitsuzukeru kunren na no yo.", en: "Mistranslation is the Hush's oldest ally. So love is the discipline of translating people correctly." },
        ],
      },
      {
        id: "ch6_p3",
        aspect: "portrait",
        beat: "Bao explains, without shame, that his blade is borrowed from the Golden Turtle and will one day be asked back — the only fighter aboard planning for peace.",
        cast: ["vo_zoro"],
        artPrompt:
          "A quiet corner of the hamam, one shaft of skylight. A Vietnamese swordsman sits cross-legged, his sheathed blade laid respectfully across his palms, showing it to unseen listeners; on the lacquered sheath is inlaid a golden turtle and the kanji 刀. Superimposed faintly in the steam above him: a misty image of Hoan Kiem lake, a sword sinking into a turtle's jaws. His expression is peaceful, unembarrassed. Leave two empty speech balloons near him.",
        texts: [
          { kind: "speech", x: 34, y: 26, speaker: "Bao", ja: "この刀は借り物だ。レ・ロイ王の剣が亀に返されたように、戦が終われば返す。", romaji: "Kono katana wa karimono da. Re Roi ou no ken ga kame ni kaesareta you ni, ikusa ga owareba kaesu.", en: "This blade is borrowed. Like King Le Loi's sword went back to the turtle, it goes back when the war ends." },
          { kind: "speech", x: 64, y: 62, speaker: "Bao", ja: "返す日を楽しみにしてる剣士は、俺くらいだろうな。", romaji: "Kaesu hi o tanoshimi ni shiteru kenshi wa, ore kurai darou na.", en: "I'm probably the only swordsman looking forward to giving his sword back." },
        ],
      },
      {
        id: "ch6_p4",
        aspect: "square",
        beat: "Sir Pebble is knighted with a biscuit-sword, everyone perfectly solemn — courage, correctly pronounced, in a body three inches tall.",
        cast: ["ch_knight", "he_yor", "pr_sen"],
        artPrompt:
          "The hamam's warm antechamber: a tiny knight made of cardboard, three inches tall, kneels with absolute gravity on an upturned soap dish while the Turkish homemaker-assassin taps each of his shoulders with a long biscuit held like a ceremonial sword. Around them the entire party stands in towels, every single face COMPLETELY solemn — no one is laughing, which is the joke. The kanji 勇 is crayoned proudly on the little knight's cardboard shield. Warm lamplight. Leave two empty speech balloons: one near the tiny knight, one near the woman.",
        texts: [
          { kind: "speech", x: 62, y: 30, speaker: "Leyla", ja: "汝を「勇」の守り手と認める。立ちなさい、ペブル卿。", romaji: "Nanji o \"yuu\" no mamorite to mitomeru. Tachinasai, Peburu-kyou.", en: "I recognize thee as keeper of Courage. Rise, Sir Pebble." },
          { kind: "speech", x: 32, y: 64, speaker: "Sir Pebble", ja: "勇気とは、恐れぬことにあらず。恐れを正しく発音することなり！", romaji: "Yuuki to wa, osorenu koto ni arazu. Osore o tadashiku hatsuon suru koto nari!", en: "Courage is not the absence of fear — it is fear, correctly pronounced!" },
        ],
      },
      {
        id: "ch6_p5",
        aspect: "portrait",
        beat: "The theft discovered: Kael 'Echo' stands in the cooling-room doorway, stolen words orbiting him like moths — and Pip hears the terror underneath.",
        cast: ["nc_echo", "he_anya"],
        artPrompt:
          "The hamam's cooling-room doorway at night, steam thinning to cold air. A pale Icelandic young man in a weathered traveler's coat stands framed in the arch, caught mid-escape: around him orbit dozens of small glowing word-shapes like moths circling a lamp, each one flickering, stolen. His face is defiant but his eyes are pure panic. The kanji 響 shimmers faintly among the orbiting words. In the foreground, the small German girl points at him, stricken with sudden pity. Leave two empty speech balloons: one near the man, one near the girl.",
        texts: [
          { kind: "speech", x: 60, y: 28, speaker: "Echo", ja: "盗んだんじゃない、「保存」してるんだ！お前たちには分からない——言語が死ぬ音は！", romaji: "Nusunda n ja nai, \"hozon\" shiteru n da! Omaetachi ni wa wakaranai —— gengo ga shinu oto wa!", en: "I'm not stealing — I'm preserving! You don't know what a language sounds like when it's dying!" },
          { kind: "speech", x: 28, y: 66, speaker: "Pip", ja: "きこえるよ…この人の下にあるのは、こわい、こわい、こわい、だけだ。", romaji: "Kikoeru yo… kono hito no shita ni aru no wa, kowai, kowai, kowai, dake da.", en: "I can hear it… underneath him there's nothing but afraid, afraid, afraid." },
        ],
      },
      {
        id: "ch6_p6",
        aspect: "portrait",
        beat: "Grandfather Ash, alone in the steam, remembers Halime — and the steam faintly forms a reading woman. The memory that keeps Rule Three from finishing her.",
        cast: ["sp_kama"],
        artPrompt:
          "The empty hamam at closing, one lamp. An ancient bathhouse spirit — a stooped, kindly old-man djinn whose beard drifts like steam, skin patterned like cracked marble tile — sits alone by the central stone, one hand raised into the vapor. The rising steam has gathered, faintly but unmistakably, into the shape of a seated woman reading a book. His expression is grief and stubborn tenderness. The kanji 湯 glows dimly in the tilework behind him. Leave one empty speech balloon near the old spirit and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 38, y: 28, speaker: "Grandfather Ash", ja: "ハリーメ。最後の常連客。わしは、まだ覚えとるぞ。", romaji: "Hariime. Saigo no jouren-kyaku. Washi wa, mada oboetoru zo.", en: "Halime. My last regular. I remember you still." },
          { kind: "caption", x: 50, y: 90, ja: "生きて、誰か一人に覚えられている限り——第三法則は、彼女を守り続ける。", romaji: "Ikite, dareka hitori ni oboerarete iru kagiri —— daisan housoku wa, kanojo o mamoritsuzukeru.", en: "Alive, and remembered by even one — Rule Three still holds her in the world." },
        ],
      },
    ],
  },

  // ── CHAPTER 7 ─────────────────────────────────────────────────────────────
  {
    n: 7,
    id: "ch7",
    titleEn: "The Con Man's True Word",
    titleJa: "嘘つきの真言",
    titleRomaji: "Usotsuki no Shingon",
    gateLevel: 30,
    setting: "Lagos, then the rock-hewn churches of Lalibela, Ethiopia",
    debutCardIds: ["ps_reigen", "po_aqua", "sl_kagura"],
    kanji: ["師", "波", "鈴"],
    panels: [
      {
        id: "ch7_p1",
        aspect: "landscape",
        beat: "A Lagos crossroads at noon: Idris confronts his uncle Kunle — the fraud who taught him to distrust words — under a shadow that points four ways at once.",
        cast: ["ps_reigen", "cu_rei"],
        artPrompt:
          "A bustling Lagos intersection at high noon, danfo buses and market stalls: at the exact center of the crossroads stand two figures face to face — a flashy middle-aged Nigerian 'psychic' in a loud suit and mirrored sunglasses, arms spread in showman's welcome, and the hooded young curse-student, fists clenched, hurt. The showman's shadow on the asphalt impossibly points in FOUR directions at once. A signboard behind them advertises fortunes, hand-painted with the kanji 師. Leave two empty speech balloons, one for each man.",
        texts: [
          { kind: "speech", x: 30, y: 28, speaker: "Idris", ja: "お、おじさんの嘘のせいで、ぼくは言葉が信じられなくなった！", romaji: "O, ojisan no uso no sei de, boku wa kotoba ga shinjirarenaku natta!", en: "B-because of your lies, I stopped trusting words at all!" },
          { kind: "speech", x: 70, y: 44, speaker: "Baba Kunle", ja: "甥っ子よ、わしは一度も「本当のこと」を売った覚えはない。売ったのは「必要なこと」だ。", romaji: "Oikko yo, washi wa ichido mo \"hontou no koto\" o utta oboe wa nai. Utta no wa \"hitsuyou na koto\" da.", en: "Nephew, I never once sold the truth. I sold what people needed to hear." },
        ],
      },
      {
        id: "ch7_p2",
        aspect: "square",
        beat: "The theological grenade: Hush-frost recoils from Kunle's patter — a kindly meant lie is still meant, and Rule One protects it, to his own horror.",
        cast: ["ps_reigen"],
        artPrompt:
          "Close manga panel in a Lagos alley: grey Hush-frost pours toward the flashy fortune-teller as he pats a weeping stranger's shoulder mid-consolation — and the frost SPLITS around him and his client like water around a stone, unable to touch the space of his patter. He is staring at the recoiling frost over the top of his sunglasses, genuinely shaken for the first time. Warm lamplight inside the untouched circle, cold grey outside it. Leave two empty speech balloons near the fortune-teller and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 40, y: 22, speaker: "Baba Kunle", ja: "……おい。なぜ効かん。わしの言葉は全部でたらめだぞ。", romaji: "……Oi. Naze kikan. Washi no kotoba wa zenbu detarame da zo.", en: "…Hey. Why isn't it working on me. Every word I say is nonsense." },
          { kind: "speech", x: 66, y: 48, speaker: "Baba Kunle", ja: "まさか——優しさで吐いた嘘は、「本気」に数えられるのか。", romaji: "Masaka —— yasashisa de haita uso wa, \"honki\" ni kazoerareru no ka.", en: "Don't tell me — a lie told out of kindness still counts as meant." },
          { kind: "caption", x: 50, y: 90, ja: "エシュは岐路の神。真実ではなく、伝言を司る。", romaji: "Eshu wa kiro no kami. Shinjitsu de wa naku, dengon o tsukasadoru.", en: "Eshu is the god of crossroads. His province is not truth — it is messages." },
        ],
      },
      {
        id: "ch7_p3",
        aspect: "landscape",
        beat: "Bet Giyorgis from above: the cross-shaped church cut down into living rock, Hush-fog pooling in the trench around it like a moat of doubt.",
        cast: ["sl_kagura"],
        artPrompt:
          "Aerial view straight down onto Bet Giyorgis, Lalibela: the great cross-shaped church carved down INTO the living rock, its roof-cross sharp in evening light — and the deep trench surrounding it is flooding with slow grey fog, a moat of static rising toward the rim. On the church roof stands a lone Ethiopian bell-keeper in white liturgical cloth, a great bronze bell beside her etched with Ge'ez letters and the kanji 鈴. Tiny chanters ring the trench edge, heads bowed in creeping doubt. Leave one empty caption box top-left and one empty speech balloon near the bell-keeper.",
        texts: [
          { kind: "caption", x: 22, y: 10, ja: "敵は聖歌を消さなかった。歌い手に「本当に意味を分かっているのか」と囁いただけだ。", romaji: "Teki wa seika o kesanakatta. Utaite ni \"hontou ni imi o wakatte iru no ka\" to sasayaita dake da.", en: "The enemy did not erase the chants. It only whispered to the chanters: are you sure you ever understood them?" },
          { kind: "speech", x: 66, y: 40, speaker: "Amara", ja: "千年歌い継いだ声が、一晩の疑いで黙っていく…！", romaji: "Sennen utaitsuida koe ga, hitoban no utagai de damatte iku…!", en: "Voices that carried a thousand years — going silent from one night of doubt…!" },
        ],
      },
      {
        id: "ch7_p4",
        aspect: "portrait",
        beat: "Kunle breaks the siege: a con man knows exactly how doubt is installed — so, chanter by chanter, he uninstalls it.",
        cast: ["ps_reigen", "sl_kagura"],
        artPrompt:
          "Inside the rock trench of Lalibela at dusk: the flashy Nigerian fortune-teller kneels eye-to-eye with an elderly Ethiopian chanter, sunglasses off for once, holding both the old man's hands, speaking low and warm — and around the two of them the grey doubt-fog visibly thins and lifts, color returning to the old chanter's face. Behind them, other chanters straighten one by one like relit candles; the bell-keeper watches from above with new respect. Leave two empty speech balloons near the fortune-teller.",
        texts: [
          { kind: "speech", x: 36, y: 24, speaker: "Baba Kunle", ja: "疑いってのはな、こうやって仕込むんだ。だから——外し方も、わしが一番知っとる。", romaji: "Utagai tte no wa na, kou yatte shikomu n da. Dakara —— hazushikata mo, washi ga ichiban shittoru.", en: "See, this is how doubt gets installed. Which means nobody knows better than me how to uninstall it." },
          { kind: "speech", x: 60, y: 58, speaker: "Baba Kunle", ja: "あんたは分かっとった。六十年、意味の中で歌っとった。それをわしが保証する。", romaji: "Anta wa wakattotta. Rokujuunen, imi no naka de utattotta. Sore o washi ga hoshou suru.", en: "You understood. Sixty years, you sang inside the meaning. I guarantee it." },
        ],
      },
      {
        id: "ch7_p5",
        aspect: "spread",
        beat: "Amara rings the great bell of Lalibela: sound rendered as concentric rings of Ge'ez and kanji interleaved — the pure act of calling-to-attention that precedes all language.",
        cast: ["sl_kagura"],
        artPrompt:
          "Full manga spread, the chapter's crown: atop the rock-hewn church at first light, the Ethiopian bell-keeper in white swings the great bronze bell with her whole body — and the SOUND is drawn: enormous concentric rings expanding across the sky and down into the fog-moat, each ring an interleaved band of Ge'ez script and kanji, the innermost ring carrying 鈴. The grey fog bursts apart where the rings pass; chanters below throw their heads back and SING. Triumphant. Baked SFX ゴーン allowed as one deep bell-strike. Leave one empty speech balloon near the bell-keeper and one empty caption box lower right.",
        texts: [
          { kind: "speech", x: 34, y: 22, speaker: "Amara", ja: "鐘は何も意味しない。ただ、すべての人を呼ぶ。——それは言葉より古い言葉！", romaji: "Kane wa nani mo imi shinai. Tada, subete no hito o yobu. —— Sore wa kotoba yori furui kotoba!", en: "A bell means nothing — and summons everyone. It is the word older than words!" },
          { kind: "caption", x: 76, y: 88, ja: "静寂に、これへの答えはない。", romaji: "Shijima ni, kore e no kotae wa nai.", en: "The Hush has no answer to this." },
        ],
      },
      {
        id: "ch7_p6",
        aspect: "landscape",
        beat: "Tidepup dives into the Blue Nile's strand carrying Amara's chant unbroken inside a wave — and three dark provinces relight behind it.",
        cast: ["po_aqua"],
        artPrompt:
          "A small water-otter pup leaps joyfully into a river at dawn, and around its body curls a single perfect standing WAVE that visibly carries sound — musical notation and Ge'ez letters suspended intact inside the water's curl like fish, with the kanji 波 gleaming in the wave's crest. Behind the pup, the river runs into the distance as a strand of light, and along the horizon three separate dark regions of the land are catching light one after another, like windows at dusk in reverse. Leave one empty caption box at the top and one small empty speech balloon near the pup.",
        texts: [
          { kind: "caption", x: 50, y: 8, ja: "「白い雑音」はどの周波数も溺れさせられる。だが、波の記憶だけは奪えない。", romaji: "\"Shiroi zatsuon\" wa dono shuuhasuu mo oboresaserareru. Daga, nami no kioku dake wa ubaenai.", en: "White Noise can drown any frequency. But it cannot take the memory of a wave." },
          { kind: "speech", x: 68, y: 62, speaker: "Tidepup", ja: "きゅい！とどける！", romaji: "Kyui! Todokeru!", en: "Kyui! Delivery!" },
        ],
      },
    ],
  },

  // ── CHAPTER 8 ─────────────────────────────────────────────────────────────
  {
    n: 8,
    id: "ch8",
    titleEn: "The Drowned Library",
    titleJa: "沈んだ書庫",
    titleRomaji: "Shizunda Shoko",
    gateLevel: 35,
    setting: "Skadar fortress, then a library drowned beneath Lisbon since 1755 — the Censor's seat",
    debutCardIds: ["ti_grim", "re_zangetsu", "cu_domain", "ne_ghost", "me_unit", "nc_kesu"],
    kanji: ["巨", "月", "域", "零", "壁", "忘"],
    panels: [
      {
        id: "ch8_p1",
        aspect: "spread",
        beat: "Dragan lets the wall of Skadar fall to save his grandmother's name — the name rising off the collapsing stones as light. Far below, something vast stirs.",
        cast: ["ti_grim"],
        artPrompt:
          "Cataclysmic manga spread: the great stone fortress wall of Skadar collapsing outward in slabs of masonry and dust — and a towering, gentle-faced Serbian giant in a wall-guard's harness stands WITH HIS BACK to the falling wall, arms wrapped protectively around empty air, refusing to hold the stones up. Off the tumbling masonry rises a woman's name written in warm light, ascending unharmed above the ruin. The kanji 壁 splits in half on a breaking stone; the kanji 巨 is stamped on the giant's shoulder-guard. In the cracked earth beneath the ruin, one immense stone eyelid — vast as a hillside — is beginning to open, seen only by the reader. Baked SFX ドドド allowed. Leave one empty speech balloon near the giant and one empty caption box lower corner.",
        texts: [
          { kind: "speech", x: 40, y: 26, speaker: "Dragan", ja: "壁は積み直せる。ばあちゃんの名前は、二つとない。……落ちろ。", romaji: "Kabe wa tsuminaoseru. Baachan no namae wa, futatsu to nai. ……Ochiro.", en: "A wall can be rebuilt. My grandmother's name cannot. …Let it fall." },
          { kind: "caption", x: 76, y: 90, ja: "保たれた石より、保たれた名が重い——その契約に、礎が身じろぎした。", romaji: "Tamotareta ishi yori, tamotareta na ga omoi —— sono keiyaku ni, ishizue ga mijirogi shita.", en: "A kept name outweighing kept stone — at that agreement, the Foundation stirred." },
        ],
      },
      {
        id: "ch8_p2",
        aspect: "landscape",
        beat: "The drowned library beneath Lisbon: shelves under green water, every erased book pristine, fish swimming through unreadable titles — the Censor's seat.",
        cast: ["nc_kesu"],
        artPrompt:
          "A vast sunken library beneath Lisbon, flooded since 1755: endless shelves under still green water lit by shafts from above, every book PERFECTLY preserved, spines legible but wrong, fish drifting between the stacks like slow thoughts. On a marble reading-dais at the center, dry inside a sphere of stillness, sits the grey-robed Censor at a desk of inkstones and knives, an old scribe's face at last visible — tired, courteous, ancient. The kanji 消 is inlaid in the dais floor. Leave one empty caption box at the top and one empty speech balloon near the Censor.",
        texts: [
          { kind: "caption", x: 50, y: 8, ja: "彼は消した書物を一冊も捨てられない。それだけが、彼に残されたすべてだから。", romaji: "Kare wa keshita shomotsu o issatsu mo suterarenai. Sore dake ga, kare ni nokosareta subete dakara.", en: "He cannot discard a single book he has erased. They are all he has left." },
          { kind: "speech", x: 64, y: 56, speaker: "The Censor", ja: "「すべてを記憶する世界は、何も赦さない。」——ようこそ、わたしの慈悲の書庫へ。", romaji: "\"Subete o kioku suru sekai wa, nani mo yurusanai.\" —— Youkoso, watashi no jihi no shoko e.", en: "'A world that remembers everything forgives nothing.' — Welcome to my library of mercies." },
        ],
      },
      {
        id: "ch8_p3",
        aspect: "portrait",
        beat: "White Noise jams every frequency — so Kojo reduces himself to his kra, a single unerasable spark, and carries the party's plan across the black, severed Lattice.",
        cast: ["ne_ghost"],
        artPrompt:
          "Near-total blackness: a vast dead expanse of severed Lattice strands hanging like cut cables in a void. Crossing it, absolutely alone, one SINGLE tiny golden spark — and inside the spark, barely visible, the folded silhouette of a young Ghanaian hacker, knees to chest, eyes calm. Around the darkness, torn fragments of grey static-storm rage but cannot find anything to grip. The kanji 零 traces the spark's trailing light. Vast negative space; the spark is small in frame. Leave one empty caption box at the top and one tiny empty thought-balloon near the spark.",
        texts: [
          { kind: "caption", x: 50, y: 10, ja: "生まれる前にニャメが灯す魂の火——クラ。それは、消すという動詞の外にある。", romaji: "Umareru mae ni Nyame ga tomosu tamashii no hi —— kura. Sore wa, kesu to iu doushi no soto ni aru.", en: "The kra — the soul-spark Nyame lights before birth. It stands outside the verb 'to erase'." },
          { kind: "thought", x: 55, y: 62, speaker: "Kojo", ja: "ゼロまで削れ。残った一が、伝令だ。", romaji: "Zero made kezure. Nokotta ichi ga, denrei da.", en: "Strip me to zero. Whatever one remains — that's the message." },
        ],
      },
      {
        id: "ch8_p4",
        aspect: "portrait",
        beat: "Unit Kappa holds the library gate: it can only counter, never initiate — and the pilots trust it precisely because it cannot strike first.",
        cast: ["me_unit"],
        artPrompt:
          "The flooded library's grand stair: a strange bio-mecha shaped vaguely like an armored kappa — a dish-like sensor crown holding luminous water, polite rounded shoulders — stands braced in a doorway as a wave of quotation-constructs breaks against it. It is drawn mid-BOW: bowing courteously to an attacking construct, and the construct, caught by the geometry of politeness, bows back, spilling its own momentum. Green water, shattering paper. The kanji 零 glows in the mecha's water-dish. Baked SFX ドンッ allowed. Leave one empty speech balloon from the mecha's comm-vents and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 40, y: 24, speaker: "Unit Kappa", ja: "礼ニハ、礼ヲ。応答スル。先制ハ、設計ニ存在シナイ。", romaji: "Rei ni wa, rei o. Outou suru. Sensei wa, sekkei ni sonzai shinai.", en: "Courtesy for courtesy. Responding. A first strike does not exist in this design." },
          { kind: "caption", x: 50, y: 90, ja: "第一法則を鋼に鋳込んだ兵器。だからこそ、乗り手はこれを信じる。", romaji: "Daiichi housoku o hagane ni ikonda heiki. Dakara koso, norite wa kore o shinjiru.", en: "Rule One, cast in steel. Which is exactly why its pilots trust it." },
        ],
      },
      {
        id: "ch8_p5",
        aspect: "portrait",
        beat: "Mateus opens his saudade-domain: inside an untranslatable word, quotation fails — and the Censor kneels, disarmed, surrounded by an absence shaped like everything he erased.",
        cast: ["cu_domain", "nc_kesu"],
        artPrompt:
          "The drowned library transfigured: a Portuguese domain-master in a Sintra school longcoat stands with one hand raised, and around him the flooded stacks have become an endless dusk-lit shoreline of longing — empty chairs facing the sea, lit windows of houses that are not there, the presence of absence made landscape. The kanji 域 burns quietly at the domain's rim. At the center the grey Censor is on his knees, his mouth open but NO quoted text emerging — his speech has failed — surrounded by a person-high ring of blank book-shaped voids. Leave two empty speech balloons: one near the domain-master, one (deliberately containing very little) near the Censor.",
        texts: [
          { kind: "speech", x: 30, y: 24, speaker: "Mateus", ja: "ここは「サウダーデ」の領域。訳せない言葉の中では——引用は、成立しない。", romaji: "Koko wa \"saudaade\" no ryouiki. Yakusenai kotoba no naka de wa —— in'you wa, seiritsu shinai.", en: "This is the domain of saudade. Inside an untranslatable word — quotation fails." },
          { kind: "speech", x: 68, y: 60, speaker: "The Censor", ja: "……………。", romaji: "…………….", en: "…………." },
        ],
      },
      {
        id: "ch8_p6",
        aspect: "portrait",
        beat: "Kwame's moon-mirror shows the Censor the scribe he was before empires. He does not die — he stops, and hands over the timetable and his last kept word.",
        cast: ["re_zangetsu", "nc_kesu"],
        artPrompt:
          "Quiet aftermath in the dusk-domain: a tall Ghanaian courier in reaper's dark cloth, a crescent-moon blade slung unused on his back, holds up a disc of soft moonlight like a hand-mirror before the kneeling Censor's face — and IN the mirror is not the grey hollow but a young scribe at a desk by lamplight, centuries ago, mending a torn scroll with total love. The Censor's grey hand rises, trembling, toward the reflection; with the other hand he holds out a folded timetable-scroll in surrender. The kanji 月 glows in the mirror's rim. Leave two empty speech balloons: one near the courier, one near the Censor.",
        texts: [
          { kind: "speech", x: 28, y: 22, speaker: "Kwame", ja: "月は記憶の鏡だ。帝国より前のあんたを、正確に映す。", romaji: "Tsuki wa kioku no kagami da. Teikoku yori mae no anta o, seikaku ni utsusu.", en: "The moon is memory's mirror. It shows you exactly who you were before the empires." },
          { kind: "speech", x: 66, y: 56, speaker: "The Censor", ja: "彗星は年内に還る。「口」は、しるしの始まった場所に開く。……わたしの最後の言葉は——救えなかった最初の書庫の、名だ。", romaji: "Suisei wa nennai ni kaeru. \"Kuchi\" wa, shirushi no hajimatta basho ni hiraku. ……Watashi no saigo no kotoba wa —— sukuenakatta saisho no shoko no, na da.", en: "The comet returns within the year. The Mouth opens where marks began. …And my last kept word — is the name of the first library I failed to save." },
          { kind: "caption", x: 50, y: 92, ja: "最初の副官は、正確に思い出されることで敗れた。", romaji: "Saisho no fukukan wa, seikaku ni omoidasareru koto de yabureta.", en: "The first lieutenant fell to being accurately remembered." },
        ],
      },
    ],
  },

  // ── CHAPTER 9 ─────────────────────────────────────────────────────────────
  {
    n: 9,
    id: "ch9",
    titleEn: "Rain Reads the Sky",
    titleJa: "雨は空を読む",
    titleRomaji: "Ame wa Sora o Yomu",
    gateLevel: 40,
    setting: "Nong Khai on the Mekong; Teotihuacan, the Avenue of the Dead",
    debutCardIds: ["ho_rain", "ch_dragon", "sh_knight", "he_bond", "sp_ohtori", "nc_wasure"],
    kanji: ["雨", "竜", "盾", "予", "空", "忘"],
    panels: [
      {
        id: "ch9_p1",
        aspect: "landscape",
        beat: "Naga fireballs rise off the Mekong at dusk; Dao reads them like lines of text, and the world's smallest dragon glows in answer on his shoulder.",
        cast: ["ho_rain", "ch_dragon"],
        artPrompt:
          "The wide Mekong at Nong Khai at deep dusk: silent globes of rose-orange fire rising slowly out of the river into low cloud — the Naga fireballs — reflected in the dark water. On a wooden pier, a lean Thai rain-keeper in a fisherman's poncho traces the rising lights with one finger like a man reading vertical script; the kanji 雨 is embroidered on his poncho's back. On his shoulder perches the world's smallest dragon, palm-sized, whose scales glow brighter with each fireball, tiny chest puffed. Leave two empty speech balloons: one near the rain-keeper, one tiny one near the dragon.",
        texts: [
          { kind: "speech", x: 32, y: 26, speaker: "Dao", ja: "空は湿気で未来の下書きを書く。読めるか？——「客が来る。千二百年ぶりの客が」。", romaji: "Sora wa shikke de mirai no shitagaki o kaku. Yomeru ka? —— \"Kyaku ga kuru. Sen-nihyaku-nen buri no kyaku ga\".", en: "The sky drafts the future in humidity. Can you read it? — 'A guest is coming. The first in twelve hundred years.'" },
          { kind: "speech", x: 74, y: 48, speaker: "Nibbles", ja: "きゅーん！竜球だ！竜はまだ、信じられてる！", romaji: "Kyuun! Ryuukyuu da! Ryuu wa mada, shinjirareteru!", en: "Kyuun! Dragon-fire! People still believe in dragons!" },
        ],
      },
      {
        id: "ch9_p2",
        aspect: "square",
        beat: "Biscuit's precognitive blind spots, inked onto Zola's aerial charts, form a word: the gaps in the good dog's foresight spell the Hush's target.",
        cast: ["he_bond", "ti_hana"],
        artPrompt:
          "A war-room table under lamplight aboard the Loanword: a large hand-drawn aerial chart of the world's Lattice-strands, and a big white fluffy dog with wise eyes has its paw planted on the map while the South African wing-scout inks small black voids wherever the dog whines and looks away. The voids — Biscuit's blind spots — connect across the chart into the unmistakable rough shape of a WORD written in gaps. The kanji 予 is stamped on the dog's collar-tag. Party members lean in from the frame edges, stunned. Leave two empty speech balloons: one near the scout, one near the dog.",
        texts: [
          { kind: "speech", x: 30, y: 24, speaker: "Zola", ja: "この子の予知は、灯った糸の先しか見えない。つまり「見えない場所」こそ——敵の予定表だ。", romaji: "Kono ko no yochi wa, tomotta ito no saki shika mienai. Tsumari \"mienai basho\" koso —— teki no yoteihyou da.", en: "His foresight only runs along lit strands. So the places he can't see — that's the enemy's calendar." },
          { kind: "speech", x: 70, y: 62, speaker: "Biscuit", ja: "わん。（そこは、見えない。だから、そこだ。）", romaji: "Wan. (Soko wa, mienai. Dakara, soko da.)", en: "Woof. (I can't see there. Which means: there.)" },
        ],
      },
      {
        id: "ch9_p3",
        aspect: "portrait",
        beat: "On the Avenue of the Dead, Tomas raises his shield: the standing memory of Zumbi of Palmares — three centuries of remembered resistance in one shadow-knight.",
        cast: ["sh_knight"],
        artPrompt:
          "The Avenue of the Dead at Teotihuacan under storm-light, pyramids looming. A Brazilian summoner in a hunter's jacket kneels with one fist to the ancient paving, and rising from his shadow stands a colossal translucent shadow-knight — a proud warrior of Palmares wreathed in three hundred years of candlelight vigils, its great shield facing an oncoming wall of grey erasure. The kanji 盾 blazes on the shield's boss. The grey wall BREAKS against the shield like surf. Baked SFX ドンッ allowed. Leave one empty speech balloon near the summoner and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 34, y: 28, speaker: "Tomas", ja: "静寂よ、三百年挑んで消せなかった名前だ。今夜も無理だ。——ズンビ、盾を！", romaji: "Shijima yo, sanbyakunen idonde kesenakatta namae da. Kon'ya mo muri da. —— Zunbi, tate o!", en: "Hush — three hundred years you've tried to erase this name and failed. Tonight is no different. Zumbi — shield!" },
          { kind: "caption", x: 50, y: 90, ja: "毎年十一月、幾百万がその名を本気で呼ぶ。それが、この盾の材質。", romaji: "Maitoshi juuichigatsu, ikuhyakuman ga sono na o honki de yobu. Sore ga, kono tate no zaishitsu.", en: "Every November, millions mean his name aloud. That is what this shield is made of." },
        ],
      },
      {
        id: "ch9_p4",
        aspect: "portrait",
        beat: "Sen sits cross-legged with the cornered Echo on the Pyramid of the Sun and teaches him one word the slow way — the first thing he has meant in years.",
        cast: ["pr_sen", "nc_echo"],
        artPrompt:
          "The flat summit of the Pyramid of the Sun at night, valley lights far below. Two figures sit cross-legged facing each other: the pale Icelandic word-thief, hood down, hollow and exhausted, and a young Listener seen mostly from behind. Between their hands passes a single small glowing word like a shared coal, lighting both faces from below. All around the thief, dozens of stolen moth-words are crumbling to ash and drifting away — except the one between their hands, which burns steady. Leave two empty speech balloons, one near each figure.",
        texts: [
          { kind: "speech", x: 32, y: 26, speaker: "Sen", ja: "盗まないで。ゆっくりでいい——形と、意味と、使い方。ぼくと一緒に、一語だけ。", romaji: "Nusumanaide. Yukkuri de ii —— katachi to, imi to, tsukaikata. Boku to issho ni, ichigo dake.", en: "Don't steal it. Go slow — the shape, the meaning, the use. Just one word, with me." },
          { kind: "speech", x: 68, y: 60, speaker: "Echo", ja: "……ああ。……ああ、これが。「本気で言う」って、こういう温度なのか。", romaji: "……Aa. ……Aa, kore ga. \"Honki de iu\" tte, kou iu ondo na no ka.", en: "…Oh. …Oh, so this is it. This is the temperature of meaning what you say." },
        ],
      },
      {
        id: "ch9_p5",
        aspect: "portrait",
        beat: "The Archivist Hollow unhoods: Halime — an old librarian, not a monster, library-dust falling through her hollow like snow. She defects, and tells Mu's whole story.",
        cast: ["nc_wasure", "sp_kama"],
        artPrompt:
          "At the base of the Pyramid of the Moon by firelight, a tall hollowed figure in Ottoman archivist's robes lowers her hood: an old Turkish librarian's face, kind and ruined, her chest an open hollow through which fine library-dust falls slowly like snow. She holds out, in both hands, a heavy vault-key in surrender. Behind her, faint in the firelight steam, the shape of an old bathhouse spirit's remembering — the strand that reached her. The kanji 忘 is pinned as an archivist's seal at her collar. Leave two empty speech balloons near her and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 34, y: 22, speaker: "Halime", ja: "わたしは言葉を救おうとして、金庫に鍵をかけた。——使われない言葉は、金庫の中で死ぬのに。", romaji: "Watashi wa kotoba o sukuou to shite, kinko ni kagi o kaketa. —— Tsukawarenai kotoba wa, kinko no naka de shinu noni.", en: "I tried to save the words by locking them in a vault. …Not knowing an unused word dies in the dark." },
          { kind: "speech", x: 64, y: 54, speaker: "Halime", ja: "聞きなさい。「無」の正体を。あれは最初の言葉——忘れられて、痛みだけが残ったもの。", romaji: "Kikinasai. \"Mu\" no shoutai o. Are wa saisho no kotoba —— wasurerarete, itami dake ga nokotta mono.", en: "Now listen. The truth of Mu. It is the first word — forgotten, until only the pain remained." },
          { kind: "caption", x: 50, y: 92, ja: "湯気の中の一人の記憶が、切れたはずの糸を伝って彼女に届いた。", romaji: "Yuge no naka no hitori no kioku ga, kireta hazu no ito o tsutatte kanojo ni todoita.", en: "One memory in the steam had traveled a strand she thought severed — and reached her." },
        ],
      },
      {
        id: "ch9_p6",
        aspect: "landscape",
        beat: "Nayeli's feathered serpent circles the pyramids and agrees: when the comet comes, the sky-rider will fly the vanguard up the last lit strand.",
        cast: ["sp_ohtori"],
        artPrompt:
          "Night sky over Teotihuacan: a magnificent feathered serpent — iridescent quetzal-green plumage, coils long as the avenue — wheels above the Pyramid of the Sun, and standing balanced on its head is a Mexican sky-rider in wind-worn gear, arms wide, laughing into the wind. The kanji 空 is painted on the banner streaming from her back. Below, tiny, the whole party looks up from the ancient avenue; one thread of light runs from the pyramids straight up past the moon. Leave one empty speech balloon near the rider and one empty caption box in a lower corner.",
        texts: [
          { kind: "speech", x: 56, y: 24, speaker: "Nayeli", ja: "ケツァルコアトルは風と文字と学びの神。つまり——彗星までの「道」は、うちの管轄！", romaji: "Ketsarukoatoru wa kaze to moji to manabi no kami. Tsumari —— suisei made no \"michi\" wa, uchi no kankatsu!", en: "Quetzalcoatl is the god of wind, writing, and learning. Which makes the road to the comet MY jurisdiction!" },
          { kind: "caption", x: 24, y: 88, ja: "敵は読めるものになった。憐れみと共に、本当の作戦が始まる——「無」への正義。", romaji: "Teki wa yomeru mono ni natta. Awaremi to tomo ni, hontou no sakusen ga hajimaru —— \"Mu\" e no seigi.", en: "The enemy had become legible. With pity came the real plan: not victory over Mu — justice for it." },
        ],
      },
    ],
  },

  // ── CHAPTER 10 ────────────────────────────────────────────────────────────
  {
    n: 10,
    id: "ch10",
    titleEn: "For the Unwritten Books",
    titleJa: "語られぬ書物のために",
    titleRomaji: "Katararenu Shomotsu no Tame ni",
    gateLevel: 44,
    setting: "Timbuktu and the Sahara's edge — the manuscript libraries and the griot lines",
    debutCardIds: ["vo_yonko", "ps_awaken", "po_legend", "nc_moku"],
    kanji: ["覇", "覚", "雷"],
    panels: [
      {
        id: "ch10_p1",
        aspect: "landscape",
        beat: "In a sand-floored courtyard, Olamide has the keepers seated in a circle, each memorizing a share of the epics — the party literally becoming a library.",
        cast: ["vo_yonko", "sh_rookie", "ch_pud", "pr_sen"],
        artPrompt:
          "A sand-floored courtyard in Timbuktu at golden hour, mud-brick walls and wooden beams. A regal West African sea-sovereign in indigo robes stands at the center of a seated circle of the party's keepers, distributing ancient manuscripts — and from each open page, lines of TEXT flow visibly up the readers' arms like luminous tattoos, settling under their skin. The kanji 覇 is woven in gold thread on the sovereign's robe. The rookie hunter writes furiously in his notebook; the small dessert-keeper balances a manuscript on a pudding tray. Leave one empty speech balloon near the sovereign and one empty caption box at the top.",
        texts: [
          { kind: "caption", x: 50, y: 8, ja: "二〇一二年、ティンブクトゥの写本は市民の手で密かに運び出され、救われた。分散——それがこの町の覚えた勝ち方。", romaji: "Nisen-juuni-nen, Tinbukutu no shahon wa shimin no te de hisoka ni hakobidasare, sukuwareta. Bunsan —— sore ga kono machi no oboeta kachikata.", en: "In 2012 the manuscripts of Timbuktu were smuggled to safety by its own people. Dispersal — this town already knows how to win." },
          { kind: "speech", x: 60, y: 52, speaker: "Olamide", ja: "グリオは七百年、スンジャータの叙事詩を紙なしで生かした。今夜から諸君が書庫だ。一人一章、覚えたまえ。", romaji: "Gurio wa nanahyakunen, Sunjaata no jojishi o kami nashi de ikashita. Kon'ya kara shokun ga shoko da. Hitori isshou, oboetamae.", en: "The griots kept Sundiata's epic alive seven hundred years without paper. From tonight, you are the library. One chapter each — memorize." },
        ],
      },
      {
        id: "ch10_p2",
        aspect: "spread",
        beat: "White Noise unleashes total static: every panel border dissolves into snow — except one small clear panel where Haru breathes.",
        cast: ["nc_moku", "ps_mob"],
        artPrompt:
          "Apocalyptic manga spread of pure STATIC: the entire image dissolving into television snow and shredded speech balloons — buildings, keepers, and sand-storm all breaking into white-grey noise; at the storm's heart hovers a gaunt hollowed man in a rotted radio-engineer's coat, headphones grown into his skull, mouth open in a soundless broadcast, the kanji 黙 flickering across his chest like a dying signal. And in one corner: a SINGLE small, perfectly clear, calm panel-within-the-panel, untouched by static, in which the thin Japanese schoolboy simply closes his eyes and breathes. Baked SFX ザーーーッ allowed everywhere in the static. Leave one empty speech balloon near the hollowed man and one empty caption box near the clear panel.",
        texts: [
          { kind: "speech", x: 60, y: 24, speaker: "White Noise", ja: "「聞こえますか」「聞こえますか」「本日も」「お聞きの」「放送は」——", romaji: "\"Kikoemasu ka\" \"kikoemasu ka\" \"honjitsu mo\" \"o-kiki no\" \"housou wa\" ——", en: "'Can you hear me' 'can you hear me' 'today's' 'broadcast' 'you are listening to'—" },
          { kind: "caption", x: 22, y: 86, ja: "皆が話し、誰も意味しない世界。ハルが生涯おそれてきた光景が、砂漠を呑んだ。", romaji: "Mina ga hanashi, dare mo imi shinai sekai. Haru ga shougai osorete kita koukei ga, sabaku o nonda.", en: "Everyone speaking, no one meaning. The thing Haru had feared his whole life swallowed the desert." },
        ],
      },
      {
        id: "ch10_p3",
        aspect: "portrait",
        beat: "Haru's awakening by inversion: one complete, unfiltered, meant sentence — and the static shatters like a struck tuning fork.",
        cast: ["ps_awaken"],
        artPrompt:
          "A full-page-feel portrait panel: the quiet Japanese schoolboy stands alone in the static-storm, uniform whipping, eyes open and streaming, speaking at last with his whole chest — and the entire wall of static around him SHATTERS outward in clean glassy shards, revealing silent desert stars behind. A soft halo of the kanji 覚 opens above his head like an eye. The composition is nearly empty and clean where the noise has broken. Leave one very large empty speech balloon taking most of the upper panel, and one small empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 50, y: 28, speaker: "Haru", ja: "ぼくは、みんなが好きだ。失うのが怖くて、ずっと黙ってた。でも言う。今、全部、本気で言う。", romaji: "Boku wa, minna ga suki da. Ushinau no ga kowakute, zutto damatteta. Demo iu. Ima, zenbu, honki de iu.", en: "I love you all. I stayed silent because I was terrified of losing you. But I'm saying it. Now. All of it. And I mean it." },
          { kind: "caption", x: 50, y: 90, ja: "覚醒は爆発ではなかった。生涯にただ一度の、濾過されない一文だった。", romaji: "Kakusei wa bakuhatsu de wa nakatta. Shougai ni tada ichido no, roka sarenai ichibun datta.", en: "The awakening was not an explosion. It was the one unfiltered sentence of a lifetime." },
        ],
      },
      {
        id: "ch10_p4",
        aspect: "portrait",
        beat: "Rafa walks into the storm's eye and introduces himself to Stormcrown — thunder answering a request where it refused every command in history.",
        cast: ["po_satoru", "po_legend"],
        artPrompt:
          "A tiny Mexican boy stands alone on open desert sand beneath a storm the size of the sky — a legendary storm-beast half-formed in the thunderhead, vast antlered silhouette of cloud and lightning, one eye a slow spiral of light, the kanji 雷 strobing inside the lightning. The boy's hand is raised in a simple, polite WAVE hello. Scale contrast is everything: the boy is a speck, calm; the sky is a god, listening. First fat raindrops crater the sand. Baked SFX ゴロゴロ allowed in the cloud. Leave one small empty speech balloon near the boy and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 44, y: 62, speaker: "Rafa", ja: "はじめまして。ぼくはラファ。命令しに来たんじゃないよ。——お願いに来たんだ。", romaji: "Hajimemashite. Boku wa Rafa. Meirei shi ni kita n ja nai yo. —— Onegai ni kita n da.", en: "Nice to meet you. I'm Rafa. I didn't come to command you — I came to ask." },
          { kind: "caption", x: 50, y: 92, ja: "畏れは命令に従わない。だが、頼まれたことは一度もなかった。", romaji: "Osore wa meirei ni shitagawanai. Daga, tanomareta koto wa ichido mo nakatta.", en: "Awe obeys no command. But in all of history, no one had ever simply asked." },
        ],
      },
      {
        id: "ch10_p5",
        aspect: "portrait",
        beat: "White Noise, unhollowed at the end, remembers his own name for one panel before dissolving — and speaks it into the rain.",
        cast: ["nc_moku", "ps_awaken"],
        artPrompt:
          "Rain falling on desert sand at night. The hollowed radio engineer kneels, headphone-growths crumbling off his skull like old plaster, static gone; his face, revealed, is an ordinary tired man's, weeping with relief. He is dissolving from the edges into quiet motes — not static, just light. Beside him the awakened schoolboy kneels too, holding him steady by one shoulder. The kanji 黙 fades from the man's chest as he finally speaks. Leave two empty speech balloons: one near the man, one near the boy.",
        texts: [
          { kind: "speech", x: 34, y: 26, speaker: "White Noise", ja: "……思い、出した。おれの、名前。電波に食わせた、おれの名前だ。……書き留めてくれるか。", romaji: "……Omoi, dashita. Ore no, namae. Denpa ni kuwaseta, ore no namae da. ……Kakitomete kureru ka.", en: "…I remember. My name. The name I fed to the airwaves. …Will you write it down?" },
          { kind: "speech", x: 68, y: 60, speaker: "Haru", ja: "うん。ちゃんと聞いてる。——ミンジェ、帳面を！", romaji: "Un. Chanto kiiteru. —— Minje, choumen o!", en: "Yes. I'm listening — really listening. Minjae, the notebook!" },
        ],
      },
      {
        id: "ch10_p6",
        aspect: "square",
        beat: "A name, written in a school notebook, rain-spotted — where the reader can find it. The Court is broken.",
        cast: ["sh_rookie"],
        artPrompt:
          "Extreme close-up, quiet and reverent: an open school notebook page in the rain, held by two careful hands — the rookie hunter's, sleeve-cuffs soaked. On the lined page, one fresh entry stands alone, ink slightly blooming where raindrops have spotted it; the writing itself is small and neat, rendered as INDISTINCT handwriting (do not render legible words). Above the page, out of focus, the desert dawn breaks. Leave one empty caption box at the top and one empty speech balloon near the hands.",
        texts: [
          { kind: "caption", x: 50, y: 10, ja: "その名はここに記され、雨に少しにじみ、二度と消されない。", romaji: "Sono na wa koko ni shirusare, ame ni sukoshi nijimi, nidoto kesarenai.", en: "The name was written here, rain-blurred at one corner, never to be erased again." },
          { kind: "speech", x: 40, y: 66, speaker: "Minjae", ja: "最弱の帳面が、また一人の人を覚えた。……宮廷は、崩れた。", romaji: "Saijaku no choumen ga, mata hitori no hito o oboeta. ……Kyuutei wa, kuzureta.", en: "The weakest notebook just remembered one more person. …And the Court is broken." },
        ],
      },
    ],
  },

  // ── CHAPTER 11 ────────────────────────────────────────────────────────────
  {
    n: 11,
    id: "ch11",
    titleEn: "The Long Return",
    titleJa: "千二百年目の帰還",
    titleRomaji: "Sen-nihyaku-nen-me no Kikan",
    gateLevel: 46,
    setting: "The high sky over the Pacific night — the last lit strand, flown to meet the comet",
    debutCardIds: ["ho_comet", "me_angel"],
    kanji: ["彗", "神", "紙"],
    panels: [
      {
        id: "ch11_p1",
        aspect: "portrait",
        beat: "The feathered serpent climbs a single thread of light out of the cloud deck, cities glowing through cloud like embers — the vanguard riding to meet a witness.",
        cast: ["sp_ohtori", "pr_sen", "nc_tsuru"],
        artPrompt:
          "Vertical panel of pure ascent: the iridescent feathered serpent spirals up a single golden thread of light that rises from a moonlit cloud deck into star-thick blackness; city-glow bleeds through the clouds below like coals under ash. On the serpent's back ride a small vanguard — the sky-rider standing at the head, a young Listener gripping plumage, a scorched paper crane tucked into the Listener's collar. Thin cold air, breath visible. Leave one empty caption box at the top and one empty speech balloon among the riders.",
        texts: [
          { kind: "caption", x: 50, y: 8, ja: "その彗星の光は、忘却より前に出発した。——最初の言葉の空を見た、最後の証人。", romaji: "Sono suisei no hikari wa, boukyaku yori mae ni shuppatsu shita. —— Saisho no kotoba no sora o mita, saigo no shounin.", en: "The comet's light left before the forgetting — the last witness to the sky under which the first word was spoken." },
          { kind: "speech", x: 60, y: 62, speaker: "Nayeli", ja: "つかまって！ここから先は、神話が交通機関よ！", romaji: "Tsukamatte! Koko kara saki wa, shinwa ga koutsuu kikan yo!", en: "Hold on! From here up, mythology IS the transit system!" },
        ],
      },
      {
        id: "ch11_p2",
        aspect: "spread",
        beat: "The Pattern manifests and rearranges the party's speech into a perfect lattice — testing whether meaning survives translation into pure structure.",
        cast: ["me_angel", "pr_sen", "sp_ohtori", "he_anya"],
        artPrompt:
          "Surreal manga spread in the high dark: an immense geometric angelic entity — nested rotating polyhedra of thin white lines, no face, serene and vast, a faint halo of the kanji 神 at its core — surrounds the riders mid-flight. The party's speech balloons have been physically LIFTED off them and rearranged in the air into a perfect crystalline lattice grid; the riders' faces are unchanged, calm, still connected by eye contact even with their words displaced. Beautiful, unsettling, silent. Leave the lattice of balloons EMPTY, plus one empty caption box at the bottom and one empty speech balloon near the geometric entity.",
        texts: [
          { kind: "caption", x: 50, y: 90, ja: "文法は、言葉より古い。それは誰も話さなくても存在する「構造」——そして今、試している。", romaji: "Bunpou wa, kotoba yori furui. Sore wa dare mo hanasanakute mo sonzai suru \"kouzou\" —— soshite ima, tameshite iru.", en: "Grammar is older than words — the structure that exists whether or not anyone speaks. And right now, it is testing." },
          { kind: "speech", x: 70, y: 22, speaker: "The Pattern", ja: "【問】語ヲ入レ替エ、声ヲ入レ替エル。ソレデモ「意味」ハ残ルカ。", romaji: "[Toi] Go o irekae, koe o irekaeru. Sore demo \"imi\" wa nokoru ka.", en: "[Query] Words exchanged. Voices exchanged. Does meaning remain?" },
        ],
      },
      {
        id: "ch11_p3",
        aspect: "portrait",
        beat: "Pip passes the test for everyone: meaning, heard directly, does not move when the words do — Chapter Four's keystone, weight-bearing at last.",
        cast: ["he_anya", "me_angel"],
        artPrompt:
          "Inside the geometric entity's lattice of displaced speech: the small German girl in the oversized coat floats calm at the center, eyes closed, one hand on her own chest and one held out — and beneath the entire scrambled lattice a soft warm underglow spreads from her, the same warm color rendering faintly under every displaced balloon, connecting each balloon back to its owner with threads of warmth. The geometric god's polyhedra have paused mid-rotation, attentive. Leave two empty speech balloons: one near the girl, one near the entity.",
        texts: [
          { kind: "speech", x: 34, y: 30, speaker: "Pip", ja: "ならべかえても、むだだよ。意味は言葉の下にすんでるの。ひっこししないの。", romaji: "Narabekaete mo, muda da yo. Imi wa kotoba no shita ni sunderu no. Hikkoshi shinai no.", en: "Rearranging is useless. Meaning lives underneath the words. It doesn't move house." },
          { kind: "speech", x: 66, y: 62, speaker: "The Pattern", ja: "【判定】——可。汝ラノ結束ハ、翻訳ニ耐エル。", romaji: "[Hantei] —— Ka. Nanjira no kessoku wa, hon'yaku ni taeru.", en: "[Verdict] — Pass. Your fellowship survives translation." },
        ],
      },
      {
        id: "ch11_p4",
        aspect: "square",
        beat: "Tsuru, made of paper, makes the kami pun to a geometric god. The Pattern does not laugh — but adjusts one angle, which Tsuru insists counts.",
        cast: ["nc_tsuru", "me_angel"],
        artPrompt:
          "A quiet comic beat in the high dark: the small scorched origami crane hovers bravely before the vast geometric angel, wings spread in a showman's flourish. One single edge of the god's outermost polyhedron is drawn freshly tilted by exactly a few degrees, with a tiny motion-tick mark — the entire divine response. The riders in the background hide grins. Leave two empty speech balloons near the crane and one near the entity.",
        texts: [
          { kind: "speech", x: 30, y: 26, speaker: "Tsuru", ja: "紙でできた私が、神と話してる。——「かみ」同士、話が早い！", romaji: "Kami de dekita watashi ga, kami to hanashiteru. —— \"Kami\" doushi, hanashi ga hayai!", en: "I'm made of kami — paper — talking to a kami — a god. Between us kami, we understand each other fast!" },
          { kind: "speech", x: 70, y: 50, speaker: "The Pattern", ja: "【応答無シ】", romaji: "[Outou nashi]", en: "[No response]" },
          { kind: "speech", x: 36, y: 78, speaker: "Tsuru", ja: "今、角度が三度動いた。笑ったのと同じ。記録して。", romaji: "Ima, kakudo ga sando ugoita. Waratta no to onaji. Kiroku shite.", en: "One angle just moved three degrees. That counts as laughing. Write it down." },
        ],
      },
      {
        id: "ch11_p5",
        aspect: "spread",
        beat: "The comet's testimony arrives: light from twelve hundred years ago falls on upturned faces — rendered as the negative of every dark panel so far.",
        cast: ["ho_comet", "pr_sen", "sp_ohtori", "he_anya", "nc_tsuru"],
        artPrompt:
          "The saga's most luminous spread, drawn as a NEGATIVE image: where every panel so far has been dark ink on light paper, this one is white line on deep-field black. A colossal comet with a fanned double tail crosses the top of the spread, and its ancient light falls in visible rays onto the small upturned faces of the riders below, etching them in reverse — white shadows, dark highlights. Within the comet's tail, faint as an afterimage: an old sky, and beneath it the barely-suggested silhouette of human figures around a fire, one mouth open — the mouth-shape of the first word (render only a silhouette, no letters). The kanji 彗 glows in the comet's core. Leave one empty caption box at the top and one empty speech balloon near the riders.",
        texts: [
          { kind: "caption", x: 50, y: 8, ja: "証言は、光のかたちで届いた。千二百年前の空。その下の、最初の言葉の口の形。", romaji: "Shougen wa, hikari no katachi de todoita. Sen-nihyaku-nen mae no sora. Sono shita no, saisho no kotoba no kuchi no katachi.", en: "The testimony arrived as light: the sky of twelve hundred years ago — and beneath it, faint, the mouth-shape of the first word." },
          { kind: "speech", x: 62, y: 66, speaker: "Sen", ja: "見えた……。あれを、覚えて帰る。世界でいちばん古い宿題だ。", romaji: "Mieta……. Are o, oboete kaeru. Sekai de ichiban furui shukudai da.", en: "I saw it… We carry that home and learn it. The oldest homework in the world." },
        ],
      },
      {
        id: "ch11_p6",
        aspect: "portrait",
        beat: "The Pattern grants the finale's instrument: an empty bracket of light in Sen's hands — a legal place in language where a new name can live.",
        cast: ["pr_sen", "me_angel"],
        artPrompt:
          "Close, sacred panel: two young hands cupped together, and resting in them a single EMPTY BRACKET of pure light — an open quotation-mark-like slot, softly luminous, clearly a container awaiting a word. The geometric angel's thin white lines frame the panel's edges, withdrawing; comet-light still silvers everything. The Listener's face stays just out of frame — only the hands and the held slot. Leave one empty speech balloon at the top and one empty caption box at the bottom.",
        texts: [
          { kind: "speech", x: 50, y: 16, speaker: "The Pattern", ja: "【付与】文法上ノ空席、一名分。——新シイ名ハ、ココニ合法的ニ住メル。", romaji: "[Fuyo] Bunpoujou no kuuseki, ichimei-bun. —— Atarashii na wa, koko ni gouhouteki ni sumeru.", en: "[Grant] One vacant grammatical seat. A new name may legally live here." },
          { kind: "caption", x: 50, y: 90, ja: "恐怖のない畏れ。宇宙はただ古く、そして聞いていた。", romaji: "Kyoufu no nai osore. Uchuu wa tada furuku, soshite kiite ita.", en: "Awe without terror. The universe was simply old, and listening." },
        ],
      },
    ],
  },

  // ── CHAPTER 12 ────────────────────────────────────────────────────────────
  {
    n: 12,
    id: "ch12",
    titleEn: "Say Its Name",
    titleJa: "名を呼べ",
    titleRomaji: "Na o Yobe",
    gateLevel: 48,
    setting: "The Bhimbetka rock shelters, Madhya Pradesh — where the Mouth opens into the Unwritten Sea",
    debutCardIds: ["re_king", "lu_queen", "sl_akatsuki", "cu_king", "ti_founder", "ne_titan", "sh_monarch", "nc_mu"],
    kanji: ["無", "間", "霊", "后", "暁", "災", "礎", "鋼", "王"],
    panels: [
      {
        id: "ch12_p1",
        aspect: "spread",
        beat: "All sixty keepers stand among Bhimbetka's painted rocks at first light — cave art and living cast one continuous mural — under Ravindra's sovereignty.",
        cast: ["sh_monarch", "pr_sen", "sl_honoka", "ti_reiner", "vo_luka", "sh_rookie", "ch_mocha"],
        artPrompt:
          "The saga's great muster, full manga spread: the Bhimbetka rock shelters of central India at first light — massive wind-carved sandstone overhangs covered in genuine-style prehistoric ochre paintings of hunters, dancers, animals — and standing among the painted figures, SIXTY keepers of every family and nation arranged so the ancient art and the living cast read as one continuous mural. At the highest ledge stands the Shadow Monarch: an Indian sovereign in dark regalia, an Ashokan pillar-edict rising behind him, the kanji 王 emblazoned on his throne-cloak. Dawn gilds every face. Leave one empty caption box across the top and one empty speech balloon near the monarch.",
        texts: [
          { kind: "caption", x: 50, y: 7, ja: "六十本の糸が、初めて一つに結ばれた。人類が最初に印を刻んだ岩の下で。", romaji: "Rokujuppon no ito ga, hajimete hitotsu ni musubareta. Jinrui ga saisho ni shirushi o kizanda iwa no shita de.", en: "For the first time, all sixty strands knotted as one — beneath the rocks where humanity first made its marks." },
          { kind: "speech", x: 66, y: 40, speaker: "Ravindra", ja: "アショーカ王は征服を捨て、石に言葉を刻んだ。王権とは——言葉を王より長生きさせる義務だ。この地は、それを覚えている。", romaji: "Ashooka-ou wa seifuku o sute, ishi ni kotoba o kizanda. Ouken to wa —— kotoba o ou yori nagaiki saseru gimu da. Kono chi wa, sore o oboete iru.", en: "Ashoka renounced conquest and carved his words in stone. Kingship is the duty to make words outlive the king — and this ground remembers." },
        ],
      },
      {
        id: "ch12_p2",
        aspect: "landscape",
        beat: "Aurelio opens the dawn-door into the Unwritten Sea, and Sable delivers the verdict that defines the ending: even erasure is owed a hearing — and a hearing requires a name.",
        cast: ["sl_akatsuki", "re_king"],
        artPrompt:
          "Before the deepest Bhimbetka overhang: a serene Roman keeper in a dawn-grey mantle stands at a natural stone arch, both palms on the rock, and where he touches, the arch fills with rising dawnlight that opens like a door onto pure whiteness — the kanji 暁 kindling in the arch's keystone. Beside the door, an androgynous French sovereign of the dead in tidal-dark court robes raises a psychopomp's staff in formal judgment, sea-mist and a faint skeletal ferryman's silhouette at their back, the kanji 霊 on the staff's seal. Two authorities: one opens, one rules. Leave two empty speech balloons, one for each figure.",
        texts: [
          { kind: "speech", x: 28, y: 26, speaker: "Aurelio", ja: "ヤヌスの門は両面を見る。すべての終わりは、始まりの顔をしている。——夜明けと共に、開こう。", romaji: "Yanusu no mon wa ryoumen o miru. Subete no owari wa, hajimari no kao o shite iru. —— Yoake to tomo ni, hirakou.", en: "Janus's door faces both ways. Every ending wears a beginning's face. — Let it open with the dawn." },
          { kind: "speech", x: 72, y: 44, speaker: "Sable", ja: "終語裁の裁定を下す。「消すもの」にさえ、審理を受ける権利がある。——そして審理には、名が要る。", romaji: "Shuugosai no saitei o kudasu. \"Kesu mono\" ni sae, shinri o ukeru kenri ga aru. —— Soshite shinri ni wa, na ga iru.", en: "The Court of the Last Word rules: even erasure is entitled to a hearing. And a hearing requires a name." },
        ],
      },
      {
        id: "ch12_p3",
        aspect: "landscape",
        beat: "On the shelter floor the party burns Morana's effigy and calls spring by name — Vesna redeemed by one relit rite — as Meridian rises beneath, refusing to let the ground be unmeant.",
        cast: ["cu_king", "ti_founder", "sl_honoka", "po_flame"],
        artPrompt:
          "Double payoff panel at the shelter's mouth: on the rock floor a straw effigy of winter burns in a ring of keepers — lit from Emberkit's carried coal by the flame-keeper's hand — and standing in the firelight, a terrible crowned sorceress-queen in calamity-black is TRANSFORMING: soot-dark robes cracking off her like ice from a thawing river, meadow-green and blossom showing beneath, the kanji 災 flaking away as she weeps. Behind and beneath everything, filling the horizon, a colossal stone guardian is rising slowly out of the earth itself, hills sliding off its shoulders, the kanji 礎 glowing in its chest-stone. Baked SFX ゴゴゴ allowed under the rising giant. Leave two empty speech balloons: one near the transforming queen, one from the ring of keepers.",
        texts: [
          { kind: "speech", x: 26, y: 30, speaker: "Keepers", ja: "モラーナは去れ！春よ、来い——ヴェスナ！ヴェスナ！ヴェスナ！", romaji: "Moraana wa sare! Haru yo, koi —— Vesuna! Vesuna! Vesuna!", en: "Winter, be gone! Come, spring — Vesna! Vesna! Vesna!" },
          { kind: "speech", x: 66, y: 36, speaker: "Vesna", ja: "ああ……村々が、わたしの名を、また本気で呼んでいる……！", romaji: "Aa…… muramura ga, watashi no na o, mata honki de yonde iru……!", en: "Ah… the villages are calling my name — and meaning it — again…!" },
          { kind: "caption", x: 50, y: 92, ja: "礎は戦わない。ただ、大地が「無意味」にされることを拒む。", romaji: "Ishizue wa tatakawanai. Tada, daichi ga \"muimi\" ni sareru koto o kobamu.", en: "The Foundation does not fight. It simply refuses to let the ground be unmeant." },
        ],
      },
      {
        id: "ch12_p4",
        aspect: "portrait",
        beat: "The descent: Bruna carries the naming-brush into the Unwritten Sea's cold, and Seraphine verifies the register's proof — Mu's line, blank but entered.",
        cast: ["ne_titan", "lu_queen", "pr_sen"],
        artPrompt:
          "The threshold of the Unwritten Sea: a whiteness beyond the dawn-door where the very panel edges thin and speech balloons visibly cannot hold their shape. Striding into it, a gleaming Brazilian full-conversion cyborg — chrome and warm bronze plating, no organic body left, kind eyes — carries a great calligraphy brush across her back like a lance, frost sheathing her steel without slowing her; the kanji 鋼 is engraved at her collar. Behind, at the door, an ethereal moon queen in silver court dress holds open an immense ledger of moonlight, pointing to ONE line that is visibly blank yet ruled and entered; the kanji 后 shines in her crown. A small Listener follows in the cyborg's lee. Leave two empty speech balloons: one near the cyborg, one near the queen.",
        texts: [
          { kind: "speech", x: 30, y: 24, speaker: "Seraphine", ja: "月の名簿に、確かに項目がある。——空白のまま、記載されている。消された。だが名を持たなかった。ゆえに、名は「未払い」よ。", romaji: "Tsuki no meibo ni, tashika ni koumoku ga aru. —— Kuuhaku no mama, kisai sarete iru. Kesareta. Daga na o motanakatta. Yue ni, na wa \"miharai\" yo.", en: "The lunar register holds its entry — blank, but entered. It was erased, yet never had a name. Therefore a name is owed." },
          { kind: "speech", x: 66, y: 58, speaker: "Bruna", ja: "肉の体は千二百年前に置いてきた。それでも私は一語一語、本気で言う。——筆は、私が運ぶ。", romaji: "Niku no karada wa sen-nihyaku-nen mae ni oite kita. Soredemo watashi wa ichigo ichigo, honki de iu. —— Fude wa, watashi ga hakobu.", en: "I gave up flesh long ago — and I still mean every word I say. The brush rides with me." },
        ],
      },
      {
        id: "ch12_p5",
        aspect: "spread",
        beat: "The saga's poster image: sixty burning kanji in a ring around a person-shaped whiteness — Mu at last manifest, quoting the party's own dead with its only voice.",
        cast: ["nc_mu", "pr_sen", "ne_titan", "sl_honoka", "sh_monarch", "re_king", "lu_queen"],
        artPrompt:
          "The climactic spread: inside the Unwritten Sea's white void, sixty keepers stand in a vast ring, and above each burns their anchor-kanji — sixty distinct glowing characters forming an unbroken circle of fire in the whiteness (render the ring of many small glowing kanji as art; individual characters may be suggested). At the ring's center: a PERSON-SHAPED ABSENCE — not a figure but a human-outlined gap in the world, whiter than the white around it, edges trembling. The keepers' stances are not combative; they are holding, speaking, meaning. Leave one empty caption box at the top and one empty speech balloon issuing from the person-shaped absence — this balloon must be drawn with a subtly WRONG, stitched-together outline.",
        texts: [
          { kind: "caption", x: 50, y: 7, ja: "包囲ではない。六十人ぶんの「本気」で編んだ、意味の結界。", romaji: "Houi de wa nai. Rokujuunin-bun no \"honki\" de anda, imi no kekkai.", en: "Not a siege — a perimeter woven from sixty keepers' meant words." },
          { kind: "speech", x: 50, y: 48, speaker: "Mu", ja: "「あの子の名を」「呼びに来たのに」「はは、悪くない取引だろ」「聞いて」——", romaji: "\"Ano ko no na o\" \"yobi ni kita noni\" \"haha, warukunai torihiki daro\" \"kiite\" ——", en: "'His name—' 'I came to say it—' 'haha, not a bad deal—' 'listen—'" },
          { kind: "caption", x: 78, y: 90, ja: "それは我らの死者の言葉だけで喋った。自分の言葉を、一つも持たないから。", romaji: "Sore wa warera no shisha no kotoba dake de shabetta. Jibun no kotoba o, hitotsu mo motanai kara.", en: "It spoke only in our dead. It has no words of its own." },
        ],
      },
      {
        id: "ch12_p6",
        aspect: "landscape",
        beat: "The smallfolk's hour: Pip hears Mu's pain underneath; Rafa waves hello and is answered; Mochi eats a quotation; Nibbles roars the first syllable.",
        cast: ["he_anya", "po_satoru", "ch_mocha", "ch_dragon", "nc_mu"],
        artPrompt:
          "Four beats in one wide panel before the person-shaped absence: the small German girl steps forward with tears running, hands pressed to her heart, HEARING; beside her the little Mexican boy raises one hand in his simple wave — and the absence's arm-gap is lifting, hesitant, mirroring the wave for the first time in twelve hundred years. Down in front, a round snack gremlin CHOMPS a floating stolen quotation-ribbon out of the air like a noodle, cheeks bulging; a palm-sized dragon plants itself, chest inflated to twice its tiny size, mid-ROAR with a visible cone of sound. Baked SFX ガブッ near the gremlin and ォォォン near the little roar allowed. Leave three empty speech balloons: one near the girl, one near the boy, one small one near the gremlin.",
        texts: [
          { kind: "speech", x: 22, y: 26, speaker: "Pip", ja: "きこえる……。にくしみじゃない。意味されない言葉の痛みが、千二百年ぶん。", romaji: "Kikoeru……. Nikushimi ja nai. Imi sarenai kotoba no itami ga, sen-nihyaku-nen bun.", en: "I can hear it… It's not hatred. It's the pain of an unmeant word — twelve hundred years of it." },
          { kind: "speech", x: 52, y: 40, speaker: "Rafa", ja: "はじめまして！", romaji: "Hajimemashite!", en: "Nice to meet you!" },
          { kind: "speech", x: 76, y: 66, speaker: "Mochi", ja: "むぐむぐ。ナンセンスは引用できないのだ！", romaji: "Mugumugu. Nansensu wa in'you dekinai no da!", en: "Nom nom. You can't quote nonsense!" },
        ],
      },
      {
        id: "ch12_p7",
        aspect: "spread",
        beat: "Sen writes the name with Bruna's brush — the stroke order of 間 shown across four micro-panels — and teaches the reader the saga's final word as the act that ends the war.",
        cast: ["pr_sen", "ne_titan", "nc_mu"],
        artPrompt:
          "The finishing move as comprehension, full spread: a young Listener, face just out of frame, holds the great calligraphy brush steadied by a chrome cyborg hand over theirs, writing in the air before the person-shaped absence. The spread contains FOUR inset micro-panels in sequence showing the same airborne glowing character being built stroke by stroke, stroke order clearly progressing, until the completed kanji 間 blazes gold between Sen and the absence — a gate with the sun inside it. As the final stroke lands, the absence's empty outline begins to FILL with soft ink-grey, becoming a small, quiet figure. You MAY render the glowing airborne kanji 間 and its partial stroke forms; no other text in the art. Leave one empty speech balloon near Sen and two empty caption boxes along the bottom for the teaching text.",
        texts: [
          { kind: "speech", x: 30, y: 22, speaker: "Sen", ja: "ぼくは戦えない。ぼくにできるのは、これだけだ。——おまえの名前は、「間」。言葉と言葉のあいだの、休み。声に形をあげる、静けさだ。", romaji: "Boku wa tatakaenai. Boku ni dekiru no wa, kore dake da. —— Omae no namae wa, \"ma\". Kotoba to kotoba no aida no, yasumi. Koe ni katachi o ageru, shizukesa da.", en: "I can't fight. This is the only thing I've ever done. — Your name is Ma. The rest between words. The silence that gives every voice its shape." },
          { kind: "caption", x: 30, y: 90, ja: "間（ま）", romaji: "ma", en: "間 ma — the pause between words; the interval that gives speech its shape" },
          { kind: "caption", x: 74, y: 90, ja: "名を持つものは、言語の内側にいる。有限で、呼びかけられて、文法に住む。", romaji: "Na o motsu mono wa, gengo no uchigawa ni iru. Yuugen de, yobikakerarete, bunpou ni sumu.", en: "A named thing is inside language: finite, addressable, at home in grammar." },
        ],
      },
      {
        id: "ch12_p8",
        aspect: "landscape",
        beat: "Epilogue: Mu — small now, keeper of 無 — sits at the edge of the campfire circle, the silence between everyone's words at last where it belongs; far past the comet's orbit, one strand hums.",
        cast: ["nc_mu", "pr_sen", "sl_honoka", "po_flame", "sh_rookie", "lu_queen"],
        artPrompt:
          "The last page: night at Bhimbetka, an ordinary orange campfire — lit from Emberkit's coal, the little fire-fox asleep beside it — ringed by keepers talking, laughing, passing food. At the circle's edge sits a small, quiet, ink-grey figure with a gentle unfinished face: Mu, named, hands folded, occupying the pauses in the conversation like a held note; the kanji 無 rests calm on its chest. The rookie hunter hands his battered notebook up to the silver moon queen, who receives it into her ledger of moonlight. High above, past the stars, ONE hair-thin strand of light runs out of frame, faintly humming with a wrong-colored pulse. Leave one empty caption box at the top, one empty speech balloon near Mu, and one small empty caption box at the very bottom corner.",
        texts: [
          { kind: "caption", x: 50, y: 8, ja: "静寂は消えなかった。言葉の一部になった。——消された言葉は学び直されるまで戻らない。世界の修繕は、あなたの復習と同じ速さで進む。", romaji: "Shijima wa kienakatta. Kotoba no ichibu ni natta. —— Kesareta kotoba wa manabinaosareru made modoranai. Sekai no shuuzen wa, anata no fukushuu to onaji hayasa de susumu.", en: "The silence did not vanish. It became a part of speech. The words erased before the naming stay lost until relearned — the world's repair moves exactly as fast as your review." },
          { kind: "speech", x: 62, y: 56, speaker: "Mu", ja: "……間。……ぼくの、名前。", romaji: "……Ma. ……Boku no, namae.", en: "…Ma. …My name." },
          { kind: "caption", x: 82, y: 92, ja: "——彗星の軌道の遥か外で、一本の糸が、誰も知らない言葉で震えていた。", romaji: "—— Suisei no kidou no haruka soto de, ippon no ito ga, dare mo shiranai kotoba de furuete ita.", en: "— And far past the comet's orbit, one strand hummed in a tongue no one knew." },
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
