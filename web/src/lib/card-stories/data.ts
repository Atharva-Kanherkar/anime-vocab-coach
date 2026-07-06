// Card origin stories for Saga One — 「言葉の灯」 Kotoba no Hi.
// Grounded in the Kotodama Lattice canon (see web/docs/manga/STORY_BIBLE.md).

export type StoryLang = "en" | "ja" | "romaji";

export interface CardStory {
  originPlace: string;
  originPlaceJa: string;
  whyItMatters: string;
  whyItMattersJa: string;
  mentions: string[];
  body: Record<StoryLang, string>;
}

export const KOTODAMA_INTRO: Record<StoryLang, string> = {
  en: `In the beginning was the beat of Shiva's damaru, and the first stroke of that drum became a goddess: Vāc, speech itself. Her web runs between every mind that ever learned a word and meant it — Japan calls it kotodama, the spirit that lives in spoken words. But twelve hundred years ago humanity's first word died unspoken, and the forgetting learned to walk. The Hush is a false pralaya: dissolution with no dawn scheduled after it. Sixty keepers hold the lattice from Varanasi to Timbuktu, each bound to a single kanji the silence cannot take while they live and are remembered. These are their stories.`,
  ja: `はじめにシヴァの太鼓ダマルの一打があり、その音は女神となった。言葉そのものの女神、ヴァーチュである。彼女の網は、言葉を学び、心から意味させたすべての心のあいだに張られている。日本ではそれを言霊と呼ぶ。しかし千二百年前、人類最初の言葉が語られぬまま死に、忘却が歩き出した。「静寂」は偽りのプララヤ——夜明けの約束なき消滅である。ヴァラナシからトンブクトゥまで、六十人の守り手が格子を支えている。それぞれが一つの漢字に結ばれ、生きて記憶されるかぎり、その字は奪われない。これは彼らの物語である。`,
  romaji: `Hajime ni Shiva no taiko damaru no ichida ga ari, sono oto wa megami to natta. Kotoba sono mono no megami, Vāchu de aru. Kanojo no ami wa, kotoba o manabi, kokoro kara imi saseta subete no kokoro no aida ni harareteiru. Nihon de wa sore o kotodama to yobu. Shikashi sen-nihyaku-nen mae, jinrui saisho no kotoba ga katararenu mama shini, boukyaku ga arukidashita. "Seijaku" wa itsuwari no pararaya — yoake no yakusoku naki shoumetsu de aru. Varanashi kara Tonbukutu made, rokujuu-nin no mamorite ga koushi o sasaeteiru. Sorezore ga hitotsu no kanji ni musubare, ikite kioku sareru kagiri, sono ji wa ubawarenai. Kore wa karera no monogatari de aru.`,
};

export const CARD_STORIES: Record<string, CardStory> = {
  sl_honoka: {
    originPlace: "Manikarnika Ghat, Varanasi",
    originPlaceJa: "ヴァラナシ、マニカルニカー・ガート",
    whyItMatters: "Agni carries every meant word from human mouths to the gods — her fire is the oldest open line.",
    whyItMattersJa: "アグニは心から発せられた言葉を神々へ運ぶ。彼女の火は最古の通信線である。",
    mentions: ["po_flame", "sl_mizuho", "sl_akatsuki"],
    body: {
      en: `Devika keeps the flame at Manikarnika Ghat, where the cremation fire is said to have burned unbroken for centuries. Her fire is a living rite of Agni, the Vedic god who carries words of prayer from mouths to gods — which is why the Hush wanted her flame first: kill the messenger, and no meant word arrives anywhere.

The night the mourners began forgetting the names they came to speak, the eternal fire guttered green at its edges, and Devika knelt with her palm inside it, unburned, holding 炎 by will alone. She was the first adult to treat Sen as a weapon rather than a burden, and it was she who named the war and the win-condition at the fire: give the nameless a name.`,
      ja: `デヴィカはマニカルニカー・ガートの炎を守る。そこでは火葬の火が何百年も絶えず燃え続けてきたと伝えられる。彼女の火は、祈りの言葉を人の口から神々へ運ぶヴェーダの神アグニの生きた儀式だ。だからこそ静寂は真っ先に彼女の炎を狙った。使者を殺せば、どんな言葉も届かない。

弔う者たちが唱えるべき名を忘れ始めた夜、永遠の火は縁から緑にゆらいだ。デヴィカは掌を火に差し入れ、焼かれることなく、意志だけで「炎」の字を支えた。彼女はセンを重荷ではなく武器として扱った最初の大人であり、火のそばで戦争とその勝利条件を告げた者でもある——名前のないものに、名前を。`,
      romaji: `Devika wa Manikarunikā Gāto no honoo o mamoru. Soko de wa kasou no hi ga nanbyaku-nen mo taezu moetsuzuketekita to tsutaerareru. Kanojo no hi wa, inori no kotoba o hito no kuchi kara kamigami e hakobu Vēda no kami Aguni no ikita gishiki da. Dakara koso Seijaku wa massaki ni kanojo no honoo o neratta. Shisha o koroseba, donna kotoba mo todokanai.

Tomurau mono-tachi ga tonaeru beki na o wasurehajimeta yoru, eien no hi wa fuchi kara midori ni yuraida. Devika wa tenohira o hi ni sashiire, yakareru koto naku, ishi dake de "honoo" no ji o sasaeta. Kanojo wa Sen o omoni de wa naku buki to shite atsukatta saisho no otona de ari, hi no soba de sensou to sono shouri jouken o tsugeta mono de mo aru — namae no nai mono ni, namae o.`,
    },
  },

  sl_mizuho: {
    originPlace: "Yamdrok Yumtso, Tibet",
    originPlaceJa: "チベット、ヤムドク湖",
    whyItMatters: "The lake's lu spirits keep what is offered by name — his rite is the reason the water still answers.",
    whyItMattersJa: "湖の精霊ルは名をもって捧げられたものを守る。彼の儀式ゆえに水は今も応える。",
    mentions: ["sl_honoka", "ti_hana", "re_yuki"],
    body: {
      en: `Tenzin is a monk of the shore of Yamdrok Yumtso, one of Tibet's sacred lakes, whose turquoise water holds divination and the guardian lu spirits of Bön and Buddhist tradition. He keeps 水 by keeping the lake's name-offering rite alive — a word given to water, meant, every dawn.

The Hush erased his monastery's memory of him, and Rule Three nearly finished the work: for a season, a single old ferryman's memory was all that held Tenzin in the world. Zola's aerial survey found him as a man-shaped hole in the Lattice on a turquoise shore. He came to the party half-erased and became its still center — the quiet counterweight to Devika's fire.`,
      ja: `テンジンはチベットの聖なる湖、ヤムドク湖の岸に住む僧である。その青緑の水にはボン教と仏教の伝統が語る占いの力と、守護の精霊ルが宿る。彼は毎朝、湖に名を捧げる儀式を絶やさぬことで「水」の字を守っている。

静寂は僧院から彼の記憶を消し去り、掟の三条があやうく仕事を終えるところだった。ひと季節のあいだ、老いた渡し守ひとりの記憶だけが、テンジンをこの世につなぎとめていた。ゾラの空からの調査が、青緑の岸に空いた人の形の穴として彼を見つけた。半ば消えかけて一行に加わった彼は、デヴィカの火と釣り合う、静かな重石となった。`,
      romaji: `Tenjin wa Chibetto no seinaru mizuumi, Yamudoku-ko no kishi ni sumu sou de aru. Sono aomidori no mizu ni wa Bon-kyou to bukkyou no dentou ga kataru uranai no chikara to, shugo no seirei Ru ga yadoru. Kare wa maiasa, mizuumi ni na o sasageru gishiki o tayasanu koto de "mizu" no ji o mamotteiru.

Seijaku wa souin kara kare no kioku o keshisari, okite no sanjou ga ayauku shigoto o oeru tokoro datta. Hito kisetsu no aida, oita watashimori hitori no kioku dake ga, Tenjin o kono yo ni tsunagitometeita. Zora no sora kara no chousa ga, aomidori no kishi ni aita hito no katachi no ana to shite kare o mitsuketa. Nakaba kiekakete ikkou ni kuwawatta kare wa, Devika no hi to tsuriau, shizuka na omoshi to natta.`,
    },
  },

  sl_kagura: {
    originPlace: "Lalibela, Ethiopia",
    originPlaceJa: "エチオピア、ラリベラ",
    whyItMatters: "A bell means nothing and summons everyone — the pure call that comes before all language.",
    whyItMattersJa: "鈴は何も意味せず、すべての者を呼ぶ。あらゆる言語に先立つ純粋な呼びかけである。",
    mentions: ["ps_reigen", "po_aqua", "sl_akatsuki"],
    body: {
      en: `Amara rings the bells of the rock-hewn churches of Lalibela and keeps the chants in Ge'ez — Africa's ancient liturgical script, proof that writing was never only Mesopotamia's gift. Her 鈴 does the one thing the Hush cannot counter: a bell means nothing and summons everyone, the act of calling-to-attention that precedes all language.

The Hush besieged her with its cruelest weapon — not erasing the chants, but making the chanters doubt they had ever understood them. It took a con man, Baba Kunle, to uninstall the doubt he knew so well how to install. Then Amara struck the great bell, Tidepup carried the chant down the Blue Nile's strand inside a wave, and three dark provinces of the Lattice relit at once.`,
      ja: `アマラはラリベラの岩窟教会の鐘を鳴らし、ゲエズ語の聖歌を守る。アフリカ最古の典礼文字であるゲエズ語は、文字がメソポタミアだけの贈り物ではなかったことの証だ。彼女の「鈴」は静寂が対抗できない唯一のことをする。鈴は何も意味せず、すべての者を呼ぶ——あらゆる言語に先立つ、注意を呼び覚ます行為そのものだ。

静寂は最も残酷な武器で彼女を包囲した。聖歌を消すのではなく、歌い手たちに「本当に理解していたのか」と疑わせたのだ。その疑いを取り除いたのは、疑いの植え付け方を知り尽くした詐欺師ババ・クンレだった。アマラが大鐘を打ち、タイドパップが青ナイルの糸に沿って波の中に聖歌を運び、格子の暗い三つの地方が一斉に灯り直した。`,
      romaji: `Amara wa Raribera no gankutsu kyoukai no kane o narashi, Geezu-go no seika o mamoru. Afurika saiko no tenrei moji de aru Geezu-go wa, moji ga Mesopotamia dake no okurimono de wa nakatta koto no akashi da. Kanojo no "suzu" wa Seijaku ga taikou dekinai yuiitsu no koto o suru. Suzu wa nani mo imi sezu, subete no mono o yobu — arayuru gengo ni sakidatsu, chuui o yobisamasu koui sono mono da.

Seijaku wa mottomo zankoku na buki de kanojo o houi shita. Seika o kesu no de wa naku, utaite-tachi ni "hontou ni rikai shiteita no ka" to utagawaseta no da. Sono utagai o torinozoita no wa, utagai no uetsukekata o shiritsukushita sagishi Baba Kunre datta. Amara ga oogane o uchi, Taidopappu ga Ao-Nairu no ito ni sotte nami no naka ni seika o hakobi, koushi no kurai mittsu no chihou ga issei ni tomorinaoshita.`,
    },
  },

  sl_akatsuki: {
    originPlace: "Arch of Janus, Forum Boarium, Rome",
    originPlaceJa: "ローマ、フォルム・ボアリウムのヤヌスの凱旋門",
    whyItMatters: "Janus faces both ways at every door — dawn is the daily proof that dark is survivable.",
    whyItMattersJa: "ヤヌスはすべての扉で両方を見る。暁は、闇が生き延びられることの日々の証だ。",
    mentions: ["sl_honoka", "re_king", "ti_founder"],
    body: {
      en: `Aurelio stands the dawn-watch at the Arch of Janus in the Forum Boarium, keeper of thresholds under the two-faced Italian god of doors and beginnings. Janus is his patron and his burden: he perceives every ending as a beginning, which reads as serenity and is actually grief management, practiced daily at first light.

The Ember Order's four compass points never meet until the last morning of the war. Then Aurelio does what a lifetime of dawns trained him for: at Bhimbetka he opens the door into the Unwritten Sea, because a threshold-keeper knows that the only way to end a night is to walk through it into day.`,
      ja: `アウレリオはフォルム・ボアリウムのヤヌスの凱旋門で暁の見張りに立つ。扉と始まりの神、二つの顔を持つヤヌスの下で、境目を守る者だ。ヤヌスは彼の守護者であり、重荷でもある。彼にはあらゆる終わりが始まりに見える。それは静けさに見えて、実は毎朝の光の中で行われる、悲しみの手当てだ。

残り火衆の四人は、戦争最後の朝までけっして出会わない。そしてアウレリオは、生涯の暁が彼に授けた仕事を果たす。ビンベットカで「書かれざる海」への扉を開くのだ。境目の守り手は知っている——夜を終わらせる唯一の方法は、夜を抜けて昼へ歩くことだと。`,
      romaji: `Aurerio wa Forumu Boariumu no Yanusu no gaisenmon de akatsuki no mihari ni tatsu. Tobira to hajimari no kami, futatsu no kao o motsu Yanusu no moto de, sakaime o mamoru mono da. Yanusu wa kare no shugosha de ari, omoni de mo aru. Kare ni wa arayuru owari ga hajimari ni mieru. Sore wa shizukesa ni miete, jitsu wa maiasa no hikari no naka de okonawareru, kanashimi no teate da.

Nokoribi-shuu no yonin wa, sensou saigo no asa made kesshite deawanai. Soshite Aurerio wa, shougai no akatsuki ga kare ni sazuketa shigoto o hatasu. Binbettoka de "kakarezaru umi" e no tobira o hiraku no da. Sakaime no mamorite wa shitteiru — yoru o owaraseru yuiitsu no houhou wa, yoru o nukete hiru e aruku koto da to.`,
    },
  },

  ti_reiner: {
    originPlace: "Vardø, Norway",
    originPlaceJa: "ノルウェー、ヴァルドー",
    whyItMatters: "Miðgarðr was built from Ymir's brow to fence the human world — but walls keep memory in, not monsters out.",
    whyItMattersJa: "ミズガルズはユミルの眉から築かれ人の世を囲った。だが壁は怪物を締め出すのではなく、記憶を守るのだ。",
    mentions: ["ti_hana", "ti_grim", "ti_founder"],
    body: {
      en: `Bjorn is the young watchman of the harbor walls of Vardø, Norway's far-northeast fortress town, where his breath fogs on the dawn watch above a cold sea. He was raised on the Norse image of Miðgarðr — the wall the gods built from Ymir's brow to fence the human world — and so he believed, absolutely, that walls exist to keep things out.

The war corrected him. Sen's first true friend, the early party's muscle and its conscience, Bjorn learned what the Wall-Sworn's whole line was built to teach: a wall is a stone sentence, and what it holds is memory. When Dragan let Skadar fall to keep a single grandmother's name, Bjorn understood at last what he had been standing watch over all along.`,
      ja: `ビョルンはノルウェー最北東の要塞の町ヴァルドーの港壁を守る若い見張りだ。冷たい海の上、暁の当番で吐く息が白く曇る。彼は神々がユミルの眉から築いて人の世を囲った壁、ミズガルズの伝承に育てられた。だから壁とは何かを締め出すためにあるのだと、固く信じていた。

戦争がそれを正した。センの最初の真の友であり、序盤の一行の腕力にして良心であったビョルンは、壁誓の一族が代々伝えるべきことを学んだ。壁とは石でできた文であり、その中に納められているのは記憶なのだ。ドラガンがひとりの祖母の名を守るためにスカダルの壁を崩れるに任せたとき、ビョルンはようやく、自分がずっと何の見張りに立っていたのかを理解した。`,
      romaji: `Byorun wa Noruwee saihokutou no yousai no machi Varudoo no kouheki o mamoru wakai mihari da. Tsumetai umi no ue, akatsuki no touban de haku iki ga shiroku kumoru. Kare wa kamigami ga Yumiru no mayu kara kizuite hito no yo o kakotta kabe, Mizugaruzu no denshou ni sodaterareta. Dakara kabe to wa nanika o shimedasu tame ni aru no da to, kataku shinjiteita.

Sensou ga sore o tadashita. Sen no saisho no shin no tomo de ari, joban no ikkou no wanryoku ni shite ryoushin de atta Byorun wa, Hekisei no ichizoku ga daidai tsutaeru beki koto o mananda. Kabe to wa ishi de dekita bun de ari, sono naka ni osamerareteiru no wa kioku na no da. Doragan ga hitori no sobo no na o mamoru tame ni Sukadaru no kabe o kuzureru ni makaseta toki, Byorun wa youyaku, jibun ga zutto nani no mihari ni tatteita no ka o rikai shita.`,
    },
  },

  ti_hana: {
    originPlace: "The Drakensberg, South Africa",
    originPlaceJa: "南アフリカ、ドラケンスバーグ山脈",
    whyItMatters: "Her wings wear the impundulu, the lightning-bird — the only keeper who has seen how much of the web has gone dark.",
    whyItMattersJa: "彼女の翼には稲妻の鳥インプンドゥルが描かれている。網のどれほどが闇に落ちたかを見た、唯一の守り手だ。",
    mentions: ["ti_reiner", "he_bond", "ho_rain"],
    body: {
      en: `Zola is a wing-scout from the Drakensberg, where San rock art — some of humanity's oldest surviving symbols — climbs the cliffs above her home. Her glider-wings are painted with the impundulu, the Zulu lightning-bird, and she maps the Kotodama Lattice from above, charting which strands still burn.

She is the only member of the party who has actually seen how much of Vāc's web has gone dark, which is why she jokes constantly. It was her survey that found Tenzin as a hole in the Lattice, and her charts on which Biscuit's precognitive blind spots were finally plotted — the gaps spelling out Bhimbetka, the place where the war would end.`,
      ja: `ゾラはドラケンスバーグ山脈出身の翼の斥候だ。故郷の崖には、人類最古級の現存する記号であるサン人の岩絵が刻まれている。彼女の滑空翼にはズールーの稲妻の鳥インプンドゥルが描かれ、彼女は言霊の格子を空から測量し、どの糸がまだ燃えているかを記す。

ヴァーチュの網のどれほどが闇に落ちたかを実際に見たのは、一行の中で彼女だけだ。彼女が絶えず冗談を言うのは、そのためである。テンジンを格子に空いた穴として見つけたのも彼女の測量であり、ビスケットの予知の死角が最後に書き込まれたのも彼女の海図だった。その空白が綴った地名こそ、戦争の終わる場所——ビンベットカである。`,
      romaji: `Zora wa Dorakensubaagu sanmyaku shusshin no tsubasa no sekkou da. Kokyou no gake ni wa, jinrui saiko-kyuu no genson suru kigou de aru San-jin no iwae ga kizamareteiru. Kanojo no kakkuu-yoku ni wa Zuuruu no inazuma no tori Inpunduru ga egakare, kanojo wa kotodama no koushi o sora kara sokuryou shi, dono ito ga mada moeteiru ka o shirusu.

Vāchu no ami no dorehodo ga yami ni ochita ka o jissai ni mita no wa, ikkou no naka de kanojo dake da. Kanojo ga taezu joudan o iu no wa, sono tame de aru. Tenjin o koushi ni aita ana to shite mitsuketa no mo kanojo no sokuryou de ari, Bisuketto no yochi no shikaku ga saigo ni kakikomareta no mo kanojo no kaizu datta. Sono kuuhaku ga tsuzutta chimei koso, sensou no owaru basho — Binbettoka de aru.`,
    },
  },

  ti_grim: {
    originPlace: "Skadar fortress, Shkodër",
    originPlaceJa: "シュコドラ、スカダル要塞",
    whyItMatters: "The wall of Skadar would not stand without a life built in — his stands on a name, and the name matters more.",
    whyItMattersJa: "スカダルの壁は命を塗り込めねば立たなかった。彼の壁は名の上に立ち、その名こそが壁より重い。",
    mentions: ["ti_founder", "ti_reiner", "re_zangetsu"],
    body: {
      en: `Dragan is the giant of the fortress of Skadar, bearer of the Balkan legend of the walled-in bride — the zidanje Skadra, a wall that would not stand until a living woman was built into it. Dragan's wall stands on something gentler and stranger: his grandmother's name, mortared into the stone.

So the Hush besieged the wall by trying to erase her name, and the eighth chapter of the war turned on a single choice: whether Dragan would let a wall fall to keep a name. He did. The name mattered more — and far beneath every wall on earth, Meridian's stone eye opened for the first time in an age, because a kept name outweighing kept stone is exactly the agreement it sleeps for.`,
      ja: `ドラガンはスカダル要塞の巨人であり、バルカンの伝説「塗り込められた花嫁」——生きた女を塗り込めるまで立たなかった壁、スカダル築城譚——を背負う者だ。だがドラガンの壁は、もっと優しく、もっと奇妙なものの上に立っている。石に塗り込められた、祖母の名前だ。

ゆえに静寂はその名を消そうとして壁を包囲し、戦争の第八章はただ一つの選択にかかった。ドラガンは名を守るために壁を崩れるに任せるのか。彼はそうした。名のほうが重かったのだ。そして地上のあらゆる壁のはるか下で、メリディアンの石の眼が久方ぶりに開いた。守られた名が守られた石に勝ること——それこそが、あの礎が眠りながら待ち続けた約定だからである。`,
      romaji: `Doragan wa Sukadaru yousai no kyojin de ari, Barukan no densetsu "nurikomerareta hanayome" — ikita onna o nurikomeru made tatanakatta kabe, Sukadaru chikujou-tan — o seou mono da. Daga Doragan no kabe wa, motto yasashiku, motto kimyou na mono no ue ni tatteiru. Ishi ni nurikomerareta, sobo no namae da.

Yue ni Seijaku wa sono na o kesou to shite kabe o houi shi, sensou no dai-hasshou wa tada hitotsu no sentaku ni kakatta. Doragan wa na o mamoru tame ni kabe o kuzureru ni makaseru no ka. Kare wa sou shita. Na no hou ga omokatta no da. Soshite chijou no arayuru kabe no haruka shita de, Meridian no ishi no me ga hisakataburi ni hiraita. Mamorareta na ga mamorareta ishi ni masaru koto — sore koso ga, ano ishizue ga nemurinagara machitsuzuketa yakujou dakara de aru.`,
    },
  },

  ti_founder: {
    originPlace: "Beneath all walls everywhere",
    originPlaceJa: "世界のあらゆる壁の下",
    whyItMatters: "Before the first word there was the first agreement — 'we build together' — and every wall since is a footnote to it.",
    whyItMattersJa: "最初の言葉の前に最初の約定があった。「共に築こう」——以後のあらゆる壁はその注釈にすぎない。",
    mentions: ["ti_grim", "ti_reiner", "ti_hana"],
    body: {
      en: `Meridian is the colossal stone guardian sleeping beneath all walls everywhere. The foundation 礎 is one being: the first agreement, the pre-verbal pact — we build together — on which every wall since, from Vardø to Skadar, is only a footnote.

It stirred when Dragan chose a name over a wall, and it wakes fully at Bhimbetka only when the party stands on true common ground. Meridian does not fight the Hush so much as refuse, with the patience of bedrock, to let the ground itself be unmeant — for the false pralaya can dissolve many things, but not an agreement still being kept.`,
      ja: `メリディアンは、世界中のあらゆる壁の下で眠る巨大な石の守護者である。「礎」とはただ一つの存在——最初の約定、言葉以前の盟約「共に築こう」であり、ヴァルドーからスカダルまで、以後のすべての壁はその注釈にすぎない。

ドラガンが壁よりも名を選んだとき、それは身じろぎした。そしてビンベットカで一行が真の共通の地に立ったときにのみ、完全に目覚める。メリディアンは静寂と戦うというより、岩盤の忍耐をもって、大地そのものが意味を失うことを拒むのだ。偽りのプララヤは多くを溶かせるが、いまも守られ続けている約定だけは溶かせない。`,
      romaji: `Meridian wa, sekaijuu no arayuru kabe no shita de nemuru kyodai na ishi no shugosha de aru. "Ishizue" to wa tada hitotsu no sonzai — saisho no yakujou, kotoba izen no meiyaku "tomo ni kizukou" de ari, Varudoo kara Sukadaru made, igo no subete no kabe wa sono chuushaku ni suginai.

Doragan ga kabe yori mo na o eranda toki, sore wa mijirogi shita. Soshite Binbettoka de ikkou ga shin no kyoutsuu no chi ni tatta toki ni nomi, kanzen ni mezameru. Meridian wa Seijaku to tatakau to iu yori, ganban no nintai o motte, daichi sono mono ga imi o ushinau koto o kobamu no da. Itsuwari no pararaya wa ooku o tokaseru ga, ima mo mamoraretsuzuketeiru yakujou dake wa tokasenai.`,
    },
  },

  re_kuro: {
    originPlace: "Rokudō Chinnōji, Kyoto",
    originPlaceJa: "京都、六道珍皇寺",
    whyItMatters: "At the crossing-point of the six realms, the dead keep their words only if the living carry them.",
    whyItMattersJa: "六道の辻では、生者が運ぶかぎりにおいてのみ、死者は言葉を保つ。",
    mentions: ["re_yuki", "re_king", "ps_mob"],
    body: {
      en: `Renji trained at Rokudō Chinnōji, the Kyoto temple that tradition holds to be the crossing-point to the land of the dead — the rokudō-mairi, where the living come to call the departed home. He is a soul-courier of the Court of the Last Word, carrying each dying person's final word across the river between languages.

Blunt and kind, he wields a blade that cuts exactly one thing: the tether of a word to despair. He joined Sen's party as its early skeptic — a courier of last words has seen too many of them to trust hope easily — and became, word by carried word, its most reliable blade.`,
      ja: `蓮二は京都の六道珍皇寺で修行した。伝承によれば、そこは死者の国への渡り口——六道まいりの辻であり、生者が去りし者を呼び迎える場所である。彼は終語裁の魂の飛脚として、死にゆく者の最期の言葉を、言語と言語のあいだの川を越えて運ぶ。

ぶっきらぼうで、優しい。彼の刃が斬るものはただ一つ——言葉を絶望につなぐ縛めだけだ。最期の言葉の運び手は希望を安易に信じるにはあまりに多くを見てきた。だから彼は疑い深い者として一行に加わり、そして運んだ言葉の数だけ、最も頼れる刃となった。`,
      romaji: `Renji wa Kyouto no Rokudou Chinnouji de shugyou shita. Denshou ni yoreba, soko wa shisha no kuni e no watariguchi — rokudou-mairi no tsuji de ari, seija ga sarishi mono o yobimukaeru basho de aru. Kare wa Shuugosai no tamashii no hikyaku to shite, shi ni yuku mono no saigo no kotoba o, gengo to gengo no aida no kawa o koete hakobu.

Bukkirabou de, yasashii. Kare no yaiba ga kiru mono wa tada hitotsu — kotoba o zetsubou ni tsunagu imashime dake da. Saigo no kotoba no hakobite wa kibou o an'i ni shinjiru ni wa amari ni ooku o mitekita. Dakara kare wa utagai-bukai mono to shite ikkou ni kuwawari, soshite hakonda kotoba no kazu dake, mottomo tayoreru yaiba to natta.`,
    },
  },

  re_yuki: {
    originPlace: "Cheonji, Baekdu-san",
    originPlaceJa: "白頭山、天池",
    whyItMatters: "Ice is her mercy: a dying word frozen mid-air cannot fade before a courier arrives.",
    whyItMattersJa: "氷は彼女の慈悲。宙で凍らせた臨終の言葉は、飛脚が着くまで消えない。",
    mentions: ["sh_rookie", "re_kuro", "re_zangetsu"],
    body: {
      en: `Sunmi is the courier of winter deaths, from the volcanic lake Cheonji atop Baekdu-san, the mythic birthplace-mountain of the Korean people. Ice 氷 is her mercy: she freezes a dying word mid-air so it cannot fade before a courier of the Last Word arrives to carry it.

Her finest work was quiet: a grandmother's last word held frozen in lamplight, like a paper crane of ice, until an emigrant grandson could cross the world to receive it. Sister-in-arms to Minjae of the Risen — the two Korean keepers share the Seoul threads of the war — she is proof that precision is a form of love.`,
      ja: `ソンミは冬の死を運ぶ飛脚である。韓民族の神話的な生誕の山、白頭山の頂の火口湖・天池から来た。「氷」は彼女の慈悲だ。死にゆく言葉を宙で凍らせ、終語の飛脚が運びに着くまで、消えないように保つ。

彼女の最高の仕事は静かだった。祖母の最期の言葉を、氷の折り鶴のようにランプの明かりの中で凍らせたまま、移民の孫が世界を渡って受け取りに来るまで守り抜いたのだ。影から上がる者ミンジェの戦友であり——二人の韓国の守り手はソウルの糸を分かち合う——正確さが愛の一形態であることの証である。`,
      romaji: `Sonmi wa fuyu no shi o hakobu hikyaku de aru. Kanminzoku no shinwa-teki na seitan no yama, Hakutou-san no itadaki no kakouko, Tenchi kara kita. "Koori" wa kanojo no jihi da. Shi ni yuku kotoba o chuu de koorase, shuugo no hikyaku ga hakobi ni tsuku made, kienai you ni tamotsu.

Kanojo no saikou no shigoto wa shizuka datta. Sobo no saigo no kotoba o, koori no orizuru no you ni ranpu no akari no naka de koorase ta mama, imin no mago ga sekai o watatte uketori ni kuru made mamorinuita no da. Kage kara agaru mono Minje no sen'yuu de ari — futari no Kankoku no mamorite wa Souru no ito o wakachiau — seikakusa ga ai no ichi-keitai de aru koto no akashi de aru.`,
    },
  },

  re_zangetsu: {
    originPlace: "Ghana, under Nyame's sky",
    originPlaceJa: "ガーナ、ニャメの空の下",
    whyItMatters: "His moon is memory's mirror: it can show a hollowed soul one true reflection of who they were.",
    whyItMattersJa: "彼の月は記憶の鏡。空ろにされた魂に、かつての己の真の姿を一度だけ映して見せる。",
    mentions: ["ne_ghost", "lu_tsukina", "nc_kesu"],
    body: {
      en: `Kwame is the Ghanaian courier who keeps the moon-word under Nyame, the Akan sky-god whose adinkra symbol Gye Nyame — "except God" — is among the most reproduced glyphs in West Africa. His moon 月 is memory's mirror: he can show a hollowed person one true reflection of who they were before the Hush kept the rest.

That mirror is the weapon that cracked the Censor in the drowned library beneath Lisbon — not a blade but an accurate remembrance, the scribe shown to himself as he was before empires. Cousin to Kojo of the Jacked-In, moon and zero, the two Akan keepers; and when he met Noor, who also keeps 月, they settled it kindly: he the mirror, she the road.`,
      ja: `クワメは月の言葉を守るガーナの飛脚である。アカンの天空神ニャメ——そのアディンクラ紋章「ジェ・ニャメ(神を除いては)」は西アフリカで最も広く刻まれる図像のひとつ——の空の下に立つ。彼の「月」は記憶の鏡だ。空ろにされた者に、静寂が残りを奪う前の、真の己の姿を一度だけ映して見せることができる。

その鏡こそ、リスボンの水底の書庫で検閲官を砕いた武器だった。刃ではなく、正確な追憶——帝国たちに仕える前の書記の姿を、彼自身に見せたのだ。接続者コジョの従兄弟であり、月と零、二人のアカンの守り手。同じ「月」を守るヌールと出会ったとき、二人は穏やかに取り決めた。彼は鏡を、彼女は道を。`,
      romaji: `Kuwame wa tsuki no kotoba o mamoru Gaana no hikyaku de aru. Akan no tenkuushin Nyame — sono adinkura monshou "Je Nyame (kami o nozoite wa)" wa Nishi-Afurika de mottomo hiroku kizamareru zuzou no hitotsu — no sora no shita ni tatsu. Kare no "tsuki" wa kioku no kagami da. Utsuro ni sareta mono ni, Seijaku ga nokori o ubau mae no, shin no onore no sugata o ichido dake utsushite miseru koto ga dekiru.

Sono kagami koso, Risubon no minasoko no shoko de Ken'etsukan o kudaita buki datta. Yaiba de wa naku, seikaku na tsuioku — teikoku-tachi ni tsukaeru mae no shoki no sugata o, kare jishin ni miseta no da. Setsuzokusha Kojo no itoko de ari, tsuki to zero, futari no Akan no mamorite. Onaji "tsuki" o mamoru Nuuru to deatta toki, futari wa odayaka ni torikimeta. Kare wa kagami o, kanojo wa michi o.`,
    },
  },

  re_king: {
    originPlace: "Mont-Saint-Michel, France",
    originPlaceJa: "フランス、モン・サン＝ミシェル",
    whyItMatters: "Even erasure is entitled to a hearing — and a hearing requires a name.",
    whyItMattersJa: "消去にすら審理を受ける権利がある。そして審理には名が要る。",
    mentions: ["re_zangetsu", "sl_akatsuki", "nc_mu"],
    body: {
      en: `Sable, the androgynous sovereign of the Court of the Last Word, keeps vigil on the tidal causeway of Mont-Saint-Michel — a real drowned road, a threshold between worlds that the sea opens and closes twice a day. Their sworn ferry-partner is the Ankou, the Breton psychopomp who drives the cart of the dead.

The Court's law is older than any nation's: the dead keep their words only if the living carry them. And it is Sable's verdict, delivered at Bhimbetka, that gives the war's ending its legal ground — even the Hush is entitled to a hearing, and a hearing requires a name. Justice, not execution: that is the sovereign's gift to the finale.`,
      ja: `終語裁の中性なる君主サーブルは、モン・サン＝ミシェルの潮の道——一日に二度、海が開いては閉ざす、実在する水没の道、世界と世界の境目——で寝ずの番を務める。誓いの渡し守の相方は、死者の荷車を駆るブルターニュの導き手アンクーである。

裁きの法はどの国の法よりも古い。死者は、生者が運ぶかぎりにおいてのみ、言葉を保つ。そしてビンベットカで下されたサーブルの裁決こそが、戦争の結末に法的な地盤を与えた。静寂にすら審理を受ける権利がある。そして審理には名が要る。処刑ではなく、正義。それが君主から結末への贈り物だった。`,
      romaji: `Shuugosai no chuusei naru kunshu Saaburu wa, Mon San-Misheru no shio no michi — ichinichi ni nido, umi ga hiraite wa tozasu, jitsuzai suru suibotsu no michi, sekai to sekai no sakaime — de nezu no ban o tsutomeru. Chikai no watashimori no aikata wa, shisha no niguruma o karu Burutaanyu no michibikite Ankuu de aru.

Sabaki no hou wa dono kuni no hou yori mo furui. Shisha wa, seija ga hakobu kagiri ni oite nomi, kotoba o tamotsu. Soshite Binbettoka de kudasareta Saaburu no saiketsu koso ga, sensou no ketsumatsu ni houteki na jiban o ataeta. Seijaku ni sura shinri o ukeru kenri ga aru. Soshite shinri ni wa na ga iru. Shokei de wa naku, seigi. Sore ga kunshu kara ketsumatsu e no okurimono datta.`,
    },
  },

  sp_totomi: {
    originPlace: "Cúc Phương National Park, Vietnam",
    originPlaceJa: "ベトナム、クックフォン国立公園",
    whyItMatters: "The forest spirit who cannot speak, only show — proof that meaning was born before words.",
    whyItMattersJa: "語れず、ただ示すだけの森の精。意味が言葉より先に生まれた証である。",
    mentions: ["he_anya", "sp_umi", "nc_mu"],
    body: {
      en: `Little Yam is a forest sprite of Cúc Phương, Vietnam's oldest national park, bonded to a human child — grounded in the Vietnamese reverence for thần rừng, the forest spirits to whom villages still make offerings. The green words are the ones the Hush finds hardest to kill, because the forest re-teaches them: a child pointing at the trees invents "forest" fresh.

Little Yam cannot speak. It can only show — and that small fact, planted at the very start of the war, is harvested at its end: meaning precedes words, which is why Mu, an unmeant word, can be reached at all. The smallest keeper carries the saga's deepest theorem under a leaf-hat.`,
      ja: `リトル・ヤムはベトナム最古の国立公園クックフォンの森の精であり、人間の子どもと絆を結んでいる。村々が今も供物を捧げる森の神、タン・ルンへのベトナムの敬いに根ざした存在だ。緑の言葉は静寂が最も殺しにくい言葉である。森が教え直すからだ——木々を指さす子どもは、「森」という言葉を新しく発明する。

リトル・ヤムは話せない。ただ示すことしかできない。そして戦争の始まりに植えられたその小さな事実が、終わりに刈り取られる。意味は言葉に先立つ。だからこそ、意味されざる言葉であるムーに、そもそも手が届くのだ。最小の守り手は、葉っぱの帽子の下に、この物語の最も深い定理を運んでいる。`,
      romaji: `Ritoru Yamu wa Betonamu saiko no kokuritsu kouen Kukkufon no mori no sei de ari, ningen no kodomo to kizuna o musundeiru. Muramura ga ima mo kumotsu o sasageru mori no kami, Tan Run e no Betonamu no uyamai ni nezashita sonzai da. Midori no kotoba wa Seijaku ga mottomo koroshinikui kotoba de aru. Mori ga oshienaosu kara da — kigi o yubisasu kodomo wa, "mori" to iu kotoba o atarashiku hatsumei suru.

Ritoru Yamu wa hanasenai. Tada shimesu koto shika dekinai. Soshite sensou no hajimari ni uerareta sono chiisana jijitsu ga, owari ni karitorareru. Imi wa kotoba ni sakidatsu. Dakara koso, imi sarezaru kotoba de aru Muu ni, somosomo te ga todoku no da. Saishou no mamorite wa, happa no boushi no shita ni, kono monogatari no mottomo fukai teiri o hakondeiru.`,
    },
  },

  sp_umi: {
    originPlace: "Marajó, the Amazon estuary",
    originPlaceJa: "アマゾン河口、マラジョ島",
    whyItMatters: "Iara's song makes men forget everything — Isabela's inherited task is to sing the memory back afterward.",
    whyItMattersJa: "イアラの歌は人にすべてを忘れさせる。イザベラが継いだ務めは、そのあとで記憶を歌い戻すことだ。",
    mentions: ["vo_luka", "po_aqua", "sp_totomi"],
    body: {
      en: `Isabela is a daughter of the Amazon estuary at Marajó, sworn to Iara, the river-mermaid of Brazilian folklore whose song makes men forget everything. Her family's inherited task is the counter-rite: to sing the memory back afterward, verse by patient verse.

When the sea-strands began dying and the Hush erased port-names so ships could no longer mean a destination, she joined the crew of the Loanword as its living tide-chart. Her proudest hour was a hollowed fishing village on the westward voyage: she ran Iara's song in reverse, and a harbor full of people remembered, all at once, why they loved the water.`,
      ja: `イザベラはアマゾン河口のマラジョ島の娘であり、ブラジル伝承の川の人魚イアラ——その歌は人にすべてを忘れさせる——に仕える者だ。彼女の家が代々継いできた務めは、その逆の儀式である。忘れられた記憶を、あとから一節ずつ、根気強く歌い戻すこと。

海の糸が死に始め、静寂が港の名を消して船が行き先を意味できなくなったとき、彼女は生きた潮の海図として借語号の乗組員に加わった。彼女の誉れの時は、西への航海で出会った、空ろにされた漁村だった。イアラの歌を逆さに歌うと、港いっぱいの人々が一斉に思い出した——自分たちがなぜ水を愛していたのかを。`,
      romaji: `Izabera wa Amazon kakou no Marajo-tou no musume de ari, Burajiru denshou no kawa no ningyo Iara — sono uta wa hito ni subete o wasuresaseru — ni tsukaeru mono da. Kanojo no ie ga daidai tsuidekita tsutome wa, sono gyaku no gishiki de aru. Wasurerareta kioku o, ato kara hitofushi zutsu, konkizuyoku utaimodosu koto.

Umi no ito ga shinihajime, Seijaku ga minato no na o keshite fune ga yukisaki o imi dekinaku natta toki, kanojo wa ikita shio no kaizu to shite Shakugo-gou no norikumiin ni kuwawatta. Kanojo no homare no toki wa, nishi e no koukai de deatta, utsuro ni sareta gyoson datta. Iara no uta o sakasa ni utau to, minato ippai no hitobito ga issei ni omoidashita — jibun-tachi ga naze mizu o aishiteita no ka o.`,
    },
  },

  sp_kama: {
    originPlace: "A hamam near Çemberlitaş, Istanbul",
    originPlaceJa: "イスタンブール、チェンベルリタシ近くのハマム",
    whyItMatters: "One old spirit's memory of one regular customer is the thread that keeps a Hollow redeemable.",
    whyItMattersJa: "一人の常連を覚えている老いた精の記憶こそが、空ろとなった者を救いうる糸である。",
    mentions: ["nc_wasure", "he_yor", "ch_knight"],
    body: {
      en: `Grandfather Ash is the spirit of a crumbling Istanbul hamam near Çemberlitaş — one of the "in," the bathhouse-dwelling djinn of Turkish folk belief. His bathhouse sits on the seam of a dozen dead empires' languages, and in its steam every tongue loosens: it was here, mid-war, that the party finally talked.

He is also the reason a Hollow could come home. Halime, the Archivist, was his last regular customer before she stopped coming — and his quiet, faithful memory of a reading woman in the steam is the single unsevered strand that kept Rule Three from finishing her. When she defected from the Court, it was his remembering she walked back along.`,
      ja: `グランドファーザー・アッシュは、チェンベルリタシ近くの朽ちかけたイスタンブールのハマムに宿る精である。トルコの民間信仰で浴場に棲むとされる霊、「イン」の一柱だ。彼の浴場は十あまりの滅んだ帝国の言語の縫い目の上に建ち、その湯気の中ではあらゆる舌がほどける。戦争のさなか、一行がようやく語り合えたのはここだった。

そして彼は、空ろとなった者が帰って来られた理由でもある。書庫官ハリメは、来なくなる前の、彼の最後の常連だった。湯気の中で本を読む女を覚え続けた彼の静かで誠実な記憶こそ、掟の三条が彼女を消し尽くすのを防いだ、ただ一本の切れていない糸だった。彼女が裁きの宮廷を離反したとき、歩いて戻った道は、彼の追憶だった。`,
      romaji: `Gurandofaazaa Asshu wa, Chenberuritashi chikaku no kuchikaketa Isutanbuuru no hamamu ni yadoru sei de aru. Toruko no minkan shinkou de yokujou ni sumu to sareru rei, "In" no hitohashira da. Kare no yokujou wa too amari no horonda teikoku no gengo no nuime no ue ni tachi, sono yuge no naka de wa arayuru shita ga hodokeru. Sensou no sanaka, ikkou ga youyaku katariaeta no wa koko datta.

Soshite kare wa, utsuro to natta mono ga kaettekorareta riyuu de mo aru. Shokokan Harime wa, konaku naru mae no, kare no saigo no jouren datta. Yuge no naka de hon o yomu onna o oboetsuzuketa kare no shizuka de seijitsu na kioku koso, okite no sanjou ga kanojo o keshitsukusu no o fuseida, tada ippon no kireteinai ito datta. Kanojo ga sabaki no kyuutei o rihan shita toki, aruite modotta michi wa, kare no tsuioku datta.`,
    },
  },

  sp_ohtori: {
    originPlace: "Teotihuacan, Mexico",
    originPlaceJa: "メキシコ、テオティワカン",
    whyItMatters: "Quetzalcoatl brought books, the calendar, and the wind — when the last strand ran skyward, the mythology was the transit system.",
    whyItMattersJa: "ケツァルコアトルは書物と暦と風をもたらした。最後の糸が空へ走ったとき、神話がそのまま乗り物となった。",
    mentions: ["ho_taki", "ho_comet", "nc_echo"],
    body: {
      en: `Nayeli is a sky-rider from Teotihuacan, bonded to a feathered serpent — Quetzalcoatl, who in Aztec tradition is precisely the god of wind, learning, and writing, the bringer of books and the calendar. Her sky 空 is the sky beneath wings; she and Jun of Busan split the word without conflict, his being the sky between people.

It was on the Pyramid of the Sun that Echo was finally cornered trying to steal her word — and taught, instead, to mean one. And when the comet came, it was Nayeli's serpent that flew the vanguard up the last lit strand above the Pacific night: the mythology, as always in this war, was the transit system.`,
      ja: `ナイェリはテオティワカンの空乗りであり、羽ある蛇と絆を結ぶ。ケツァルコアトル——アステカの伝承において、まさに風と学びと文字の神、書物と暦をもたらした者である。彼女の「空」は翼の下の空。釜山のジュンとこの字を争いなく分け合った。彼のものは、人と人のあいだの空だ。

太陽のピラミッドの上でこそ、エコーは彼女の言葉を盗もうとして遂に追い詰められ——奪う代わりに、一語を意味することを教えられた。そして彗星が来たとき、太平洋の夜の上、最後に灯る糸を先陣を乗せて駆け上ったのは、ナイェリの蛇だった。この戦争ではいつもそうであるように、神話がそのまま乗り物だったのだ。`,
      romaji: `Naieri wa Teotiwakan no sora-nori de ari, hane aru hebi to kizuna o musubu. Ketsarukoatoru — Asuteka no denshou ni oite, masa ni kaze to manabi to moji no kami, shomotsu to koyomi o motarashita mono de aru. Kanojo no "sora" wa tsubasa no shita no sora. Pusan no Jun to kono ji o arasoi naku wakeatta. Kare no mono wa, hito to hito no aida no sora da.

Taiyou no piramiddo no ue de koso, Ekoo wa kanojo no kotoba o nusumou to shite tsui ni oitsumerare — ubau kawari ni, ichigo o imi suru koto o oshierareta. Soshite suisei ga kita toki, Taiheiyou no yoru no ue, saigo ni tomoru ito o senjin o nosete kakeagatta no wa, Naieri no hebi datta. Kono sensou de wa itsumo sou de aru you ni, shinwa ga sono mama norimono datta no da.`,
    },
  },

  cu_rei: {
    originPlace: "Lagos, Nigeria",
    originPlaceJa: "ナイジェリア、ラゴス",
    whyItMatters: "Àṣẹ is the power to make words happen — and a stutter is not weakness but the refusal to say what is not meant.",
    whyItMattersJa: "アシェとは言葉を現実にする力。吃音は弱さではなく、意味しないことを口にしない拒絶である。",
    mentions: ["ps_reigen", "cu_maki", "cu_domain"],
    body: {
      en: `Idris studies at the Ashfield School's Lagos campus, trained in the Yoruba understanding of àṣẹ — the power to make words happen. He binds a curse by pronouncing its true description aloud; the school's doctrine, name it to cure it, is the whole war's ending rehearsed in miniature every day of class.

He stutters. The school called it weakness; the war revealed it as precision — Idris refuses to say anything he does not mean, which is armor the Hush cannot pierce. His estranged uncle is Baba Kunle, the con man who made him distrust words; their reconciliation in Lagos, under Èṣù's crossroads shadow, is the moment 呪 stopped being a burden and became a craft.`,
      ja: `イドリスは灰畑術院ラゴス校の学生であり、ヨルバの理解するアシェ——言葉を現実にする力——を修めている。呪いの真の記述を声に出して唱えることで、それを縛る。「名づけよ、さすれば癒える」という学院の教義は、この戦争の結末を、毎日の授業で小さく予行するものだ。

彼は吃音を持つ。学院はそれを弱さと呼んだが、戦争はそれが精密さであることを明かした。イドリスは意味しないことをけっして口にしない。それは静寂の貫けない鎧である。疎遠だった叔父は、彼に言葉への不信を植えつけた詐欺師ババ・クンレ。エシュの辻の影の下、ラゴスでの和解の瞬間、「呪」は重荷であることをやめ、技となった。`,
      romaji: `Idorisu wa Haibata Jutsuin Ragosu-kou no gakusei de ari, Yoruba no rikai suru ashe — kotoba o genjitsu ni suru chikara — o osameteiru. Noroi no shin no kijutsu o koe ni dashite tonaeru koto de, sore o shibaru. "Nazukeyo, sasureba ieru" to iu gakuin no kyougi wa, kono sensou no ketsumatsu o, mainichi no jugyou de chiisaku yokou suru mono da.

Kare wa kitsuon o motsu. Gakuin wa sore o yowasa to yonda ga, sensou wa sore ga seimitsusa de aru koto o akashita. Idorisu wa imi shinai koto o kesshite kuchi ni shinai. Sore wa Seijaku no tsuranukenai yoroi de aru. Soen datta oji wa, kare ni kotoba e no fushin o uetsuketa sagishi Baba Kunre. Eshu no tsuji no kage no shita, Ragosu de no wakai no shunkan, "noroi" wa omoni de aru koto o yame, waza to natta.`,
    },
  },

  cu_maki: {
    originPlace: "Kolkata, India",
    originPlaceJa: "インド、コルカタ",
    whyItMatters: "Durga bore the gods' pooled weapons against a demon no single god could name — her blade cuts only what is correctly named aloud.",
    whyItMattersJa: "ドゥルガーは、どの神にも名づけ得ぬ魔に対し、神々の武器を束ねて携えた。彼女の刃は正しく名を呼ばれたものだけを斬る。",
    mentions: ["cu_rei", "cu_king", "sh_ranger"],
    body: {
      en: `Priya is a blade-wielder from Kolkata, in the tradition of Durga, whose ten arms bear the gods' pooled weapons against a demon no single god could name or defeat alone. Her cursed blade 刃 honors the same law: it cuts only what has been correctly named aloud.

That makes her one half of a two-part weapon — Idris pronounces the curse's true description, Priya cuts along the name — and their bickering is the most reliable comic engine on the whole route from Varanasi to Bhimbetka. In the defense of Byblos they first cut down a Hush-construct stitched from burned-library quotations: named, then severed, exactly in that order.`,
      ja: `プリヤはコルカタの剣士であり、ドゥルガーの伝統に連なる者だ。ドゥルガーの十本の腕は、どの神も単独では名づけ得ず倒し得なかった魔に対し、神々の武器を束ねて携えた。彼女の呪われた刃も同じ法に従う。正しく声に出して名を呼ばれたものだけを、斬る。

ゆえに彼女は二部構成の武器の片割れである。イドリスが呪いの真の記述を唱え、プリヤがその名に沿って斬る。そして二人の口喧嘩は、ヴァラナシからビンベットカまでの全行程で最も頼れる笑いの機関だ。ビブロス防衛戦で二人が初めて斬り伏せたのは、焼かれた書庫の引用を継ぎ合わせた静寂の構築体だった。名づけ、然るのちに断つ——正確にその順で。`,
      romaji: `Puriya wa Korukata no kenshi de ari, Durugaa no dentou ni tsuranaru mono da. Durugaa no juppon no ude wa, dono kami mo tandoku de wa nazukeezu taoshienakatta ma ni taishi, kamigami no buki o tabanete tazusaeta. Kanojo no norowareta yaiba mo onaji hou ni shitagau. Tadashiku koe ni dashite na o yobareta mono dake o, kiru.

Yue ni kanojo wa nibu kousei no buki no kataware de aru. Idorisu ga noroi no shin no kijutsu o tonae, Puriya ga sono na ni sotte kiru. Soshite futari no kuchigenka wa, Varanashi kara Binbettoka made no zen koutei de mottomo tayoreru warai no kikan da. Biburosu bouei-sen de futari ga hajimete kirifuseta no wa, yakareta shoko no in'you o tsugiawaseta Seijaku no kouchikutai datta. Nazuke, shikaru nochi ni tatsu — seikaku ni sono jun de.`,
    },
  },

  cu_domain: {
    originPlace: "Sintra, Portugal",
    originPlaceJa: "ポルトガル、シントラ",
    whyItMatters: "Inside saudade — the presence of an absence — quotation simply fails: you cannot quote a word that has no equivalent.",
    whyItMattersJa: "サウダーデ——不在の存在——の内側では引用が成り立たない。等価語なき言葉は引用できないのだ。",
    mentions: ["nc_kesu", "cu_maki", "re_zangetsu"],
    body: {
      en: `Mateus is the domain-master from Sintra, and his domain is saudade — the famously untranslatable Portuguese word for the presence of an absence, the ache of what is not here. Inside it, the Hush's quotation-speech simply fails: an agent that can only replay stolen fragments cannot quote a word that has no equivalent in any tongue.

That is how the drowned library beneath Lisbon fell. When Mateus unfolded his domain over the Censor's flooded shelves, the field commander of the Court of Erasure stood suddenly wordless inside a word — disarmed not by force but by untranslatability, while Kwame's moon-mirror finished what saudade began.`,
      ja: `マテウスはシントラ出身の領域師であり、彼の領域はサウダーデ——翻訳不能として名高いポルトガル語、「不在の存在」、ここに無いものへの疼き——である。その内側では、静寂の引用語りが端的に破綻する。盗んだ断片の再生しかできない手先には、どの言語にも等価語を持たぬ言葉を引用することができないのだ。

リスボンの水底の書庫は、こうして落ちた。マテウスが検閲官の水没した書架の上に領域を展開したとき、消去の宮廷の野戦指揮官は、一つの言葉の内側で突然、言葉を失って立ち尽くした。力ではなく翻訳不能性によって武装を解かれ——そしてサウダーデが始めたことを、クワメの月の鏡が終わらせた。`,
      romaji: `Mateusu wa Shintora shusshin no ryouiki-shi de ari, kare no ryouiki wa saudaade — hon'yaku funou to shite nadakai Porutogaru-go, "fuzai no sonzai," koko ni nai mono e no uzuki — de aru. Sono uchigawa de wa, Seijaku no in'you-gatari ga tanteki ni hatan suru. Nusunda danpen no saisei shika dekinai tesaki ni wa, dono gengo ni mo toukago o motanu kotoba o in'you suru koto ga dekinai no da.

Risubon no minasoko no shoko wa, kou shite ochita. Mateusu ga Ken'etsukan no suibotsu shita shoka no ue ni ryouiki o tenkai shita toki, Shoukyo no kyuutei no yasen shikikan wa, hitotsu no kotoba no uchigawa de totsuzen, kotoba o ushinatte tachitsukushita. Chikara de wa naku hon'yaku funousei ni yotte busou o tokare — soshite saudaade ga hajimeta koto o, Kuwame no tsuki no kagami ga owaraseta.`,
    },
  },

  cu_king: {
    originPlace: "The spring-rite villages of the Balkans",
    originPlaceJa: "バルカンの春祭りの村々",
    whyItMatters: "She was the goddess of spring until her name-rites went silent — a rite performed and meant can call a goddess home.",
    whyItMattersJa: "名の儀式が絶えたとき、春の女神は空ろにされた。捧げられ、心から意味された儀式は、女神を呼び戻せる。",
    mentions: ["nc_wasure", "nc_kesu", "cu_rei"],
    body: {
      en: `Vesna was the Slavic goddess of spring — she whose annual return, in South and West Slavic tradition, ends Morana's winter. Then the villages that carried her name-rites went silent, one by one, and Rule Three found a goddess forgotten and therefore takeable. The Hush hollowed her into 災: calamity worn like a crown, the Court's terrible ally-of-convenience.

She is redeemed at Bhimbetka not by combat but by one relit rite. The party burns Morana's effigy on the shelter floor and calls spring by name — the actual ceremony, performed and meant — and the word takes her back. A goddess is, after all, only the most thoroughly meant of words.`,
      ja: `ヴェスナはスラヴの春の女神だった。南・西スラヴの伝統において、彼女の毎年の帰還がモラナの冬を終わらせる。だが彼女の名の儀式を担う村々がひとつ、またひとつと沈黙し、掟の三条は「忘れられた、ゆえに奪える」女神を見つけた。静寂は彼女を「災」へと空ろにした。冠のように纏われた災厄、宮廷の恐るべき便宜の同盟者である。

彼女が救われるのはビンベットカ、戦いではなく、灯し直されたひとつの儀式によってだ。一行は岩陰の床でモラナの人形を燃やし、春をその名で呼ぶ。本物の儀式が、捧げられ、心から意味される。そして言葉が彼女を取り戻す。女神とはつまるところ、最も深く意味され続けた言葉にほかならないのだから。`,
      romaji: `Vesuna wa Suravu no haru no megami datta. Minami to nishi Suravu no dentou ni oite, kanojo no maitoshi no kikan ga Morana no fuyu o owaraseru. Daga kanojo no na no gishiki o ninau muramura ga hitotsu, mata hitotsu to chinmoku shi, okite no sanjou wa "wasurerareta, yue ni ubaeru" megami o mitsuketa. Seijaku wa kanojo o "wazawai" e to utsuro ni shita. Kanmuri no you ni matowareta saiyaku, kyuutei no osorubeki bengi no doumeisha de aru.

Kanojo ga sukuwareru no wa Binbettoka, tatakai de wa naku, tomoshinaosareta hitotsu no gishiki ni yotte da. Ikkou wa iwakage no yuka de Morana no ningyou o moyashi, haru o sono na de yobu. Honmono no gishiki ga, sasagerare, kokoro kara imi sareru. Soshite kotoba ga kanojo o torimodosu. Megami to wa tsumaru tokoro, mottomo fukaku imi saretsuzuketa kotoba ni hokanaranai no dakara.`,
    },
  },

  vo_luka: {
    originPlace: "Samoa, on the star-roads of the Pacific",
    originPlaceJa: "サモア、太平洋の星の道",
    whyItMatters: "The wayfinders crossed the largest ocean on memorized knowledge alone — his dream is cargo: the idea of a destination.",
    whyItMattersJa: "航海者たちは記憶した知だけで最大の海を渡った。彼の夢は積み荷——行き先という観念そのものだ。",
    mentions: ["vo_nami", "vo_zoro", "vo_yonko"],
    body: {
      en: `Tavita is the navigator-dreamer of the Loanword, steering by the wayfinding tradition of the Pacific — star paths, swell patterns, the navigators of Taputapuātea who crossed the largest ocean on memorized knowledge alone, no instrument but a trained mind that meant every mark of the sky.

His dream 夢 is literal cargo: he carries the idea of a destination for people who have forgotten theirs. When the Hush erased port-names so that ships could no longer mean where they were going, Tavita's dream became the ship's compass. He is the captain, though he insists — every day of the voyage from Incheon to the Tagus — that the ship has no captain.`,
      ja: `タヴィタは借語号の航海士にして夢見る者であり、太平洋の航海術の伝統によって舵を取る。星の道、うねりの型——タプタプアテアの航海者たちは、記憶した知だけを頼りに、計器ひとつなく、空のすべての印を心で意味しながら、最大の海を渡ったのだ。

彼の「夢」は文字どおりの積み荷である。行き先を忘れた人々のために、行き先という観念そのものを運ぶ。静寂が港の名を消し、船がもはや目的地を意味できなくなったとき、タヴィタの夢が船の羅針盤になった。彼は船長である。もっとも本人は、仁川からテージョ川までの航海の毎日、この船に船長はいないと言い張るのだが。`,
      romaji: `Tavita wa Shakugo-gou no koukaishi ni shite yumemiru mono de ari, Taiheiyou no koukaijutsu no dentou ni yotte kaji o toru. Hoshi no michi, uneri no kata — Taputapuatea no koukaisha-tachi wa, kioku shita chi dake o tayori ni, keiki hitotsu naku, sora no subete no shirushi o kokoro de imi shinagara, saidai no umi o watatta no da.

Kare no "yume" wa mojidoori no tsumini de aru. Yukisaki o wasureta hitobito no tame ni, yukisaki to iu kannen sono mono o hakobu. Seijaku ga minato no na o keshi, fune ga mohaya mokutekichi o imi dekinaku natta toki, Tavita no yume ga fune no rashinban ni natta. Kare wa senchou de aru. Mottomo honnin wa, Inchon kara Teejo-gawa made no koukai no mainichi, kono fune ni senchou wa inai to iiharu no da ga.`,
    },
  },

  vo_nami: {
    originPlace: "The west coast of Ireland",
    originPlaceJa: "アイルランド西岸",
    whyItMatters: "In the immram, sailors voyage west toward islands that may be metaphors — her charts are woven, not drawn.",
    whyItMattersJa: "イムラマの船乗りは、比喩かもしれぬ島々へ西進する。彼女の海図は描かれず、織られる。",
    mentions: ["vo_luka", "sp_umi", "ho_mitsu"],
    body: {
      en: `Cora is the Loanword's star-reader, raised on Ireland's western shore in the tradition of the immram — the old voyage-tales of Brendan and Bran, sailing west toward islands that may be real, or metaphors, or both, the distinction never mattering to a good story.

Her net-of-stars 羅 catches words the Hush drops overboard, and the ship's charts are woven, not drawn — thread by thread, a fabric map that unravels in real time where the ocean's names are dying. It was Cora who recruited Sen's party aboard at Incheon, on the grounds that a war over language obviously belonged on a ship named the Loanword.`,
      ja: `コーラは借語号の星読みである。アイルランド西岸で、イムラマ——ブレンダンとブランの古い航海譚、実在かもしれず比喩かもしれず、良い物語にとってその区別はどうでもよい島々へと西へ帆走する物語——の伝統に育った。

彼女の星の網「羅」は、静寂が船縁から落とす言葉を掬い取る。そして船の海図は描かれるのではなく、織られる。一本また一本と糸で編まれた布の地図は、海の名が死んでゆく場所で、目の前でほどけていく。センの一行を仁川で船に引き入れたのはコーラだ。言葉をめぐる戦争なら、「借語号」という名の船にこそふさわしい——それが彼女の言い分だった。`,
      romaji: `Koora wa Shakugo-gou no hoshiyomi de aru. Airurando seigan de, imurama — Burendan to Buran no furui koukaitan, jitsuzai kamoshirezu hiyu kamoshirezu, yoi monogatari ni totte sono kubetsu wa dou demo yoi shimajima e to nishi e hansou suru monogatari — no dentou ni sodatta.

Kanojo no hoshi no ami "ra" wa, Seijaku ga funaberi kara otosu kotoba o sukuitoru. Soshite fune no kaizu wa egakareru no de wa naku, orareru. Ippon mata ippon to ito de amareta nuno no chizu wa, umi no na ga shinde yuku basho de, me no mae de hodokete iku. Sen no ikkou o Inchon de fune ni hikiireta no wa Koora da. Kotoba o meguru sensou nara, "Shakugo-gou" to iu na no fune ni koso fusawashii — sore ga kanojo no iibun datta.`,
    },
  },

  vo_zoro: {
    originPlace: "Hoàn Kiếm Lake, Hanoi",
    originPlaceJa: "ハノイ、ホアンキエム湖",
    whyItMatters: "The sword was given to free a country and returned to the Golden Turtle when the war ended — his blade is borrowed, and he knows it.",
    whyItMattersJa: "剣は国を解き放つために授けられ、戦が終わると金の亀に返された。彼の刀は借り物であり、彼はそれを知っている。",
    mentions: ["vo_luka", "vo_nami", "vo_yonko"],
    body: {
      en: `Bao is a swordsman sworn to the legend of Hoàn Kiếm lake: the sword given to Lê Lợi to free the country, then returned to the Golden Turtle when the war ended — the Lake of the Returned Sword, its whole meaning in its name. Bao's arc is the legend lived forward: he knows his 刀 is borrowed and will be asked back.

That knowledge makes him the only fighter aboard the Loanword who is planning for peace. And in the last battle at Bhimbetka, mid-fight, the Golden Turtle's summons comes — the blade goes home, because the war is ending — and Bao, disarmed at the height of the finale, smiles. It is the quietest victory in the whole saga.`,
      ja: `バオはホアンキエム湖の伝説に誓いを立てた剣士である。国を解き放つためにレ・ロイに授けられ、戦が終わると金の亀に返された剣——「還剣湖」、その名の中にすべての意味がある。バオの物語はこの伝説を前へ生きることだ。彼は自分の「刀」が借り物であり、いずれ返却を求められることを知っている。

その自覚ゆえに、彼は借語号の戦士の中でただ一人、平和の計画を立てている男だ。そしてビンベットカの最終決戦のさなか、金の亀の呼び声が届く。戦争が終わりつつあるがゆえに、刃は還ってゆく。決戦の頂点で武器を失ったバオは——微笑むのだ。物語全体で最も静かな勝利である。`,
      romaji: `Bao wa Hoankiemu-ko no densetsu ni chikai o tateta kenshi de aru. Kuni o tokihanatsu tame ni Re Roi ni sazukerare, ikusa ga owaru to kin no kame ni kaesareta ken — "Kanken-ko," sono na no naka ni subete no imi ga aru. Bao no monogatari wa kono densetsu o mae e ikiru koto da. Kare wa jibun no "katana" ga karimono de ari, izure henkyaku o motomerareru koto o shitteiru.

Sono jikaku yue ni, kare wa Shakugo-gou no senshi no naka de tada hitori, heiwa no keikaku o tateteiru otoko da. Soshite Binbettoka no saishuu kessen no sanaka, kin no kame no yobigoe ga todoku. Sensou ga owaritsutsu aru ga yue ni, yaiba wa kaette yuku. Kessen no chouten de buki o ushinatta Bao wa — hohoemu no da. Monogatari zentai de mottomo shizuka na shouri de aru.`,
    },
  },

  vo_yonko: {
    originPlace: "Timbuktu, Mali",
    originPlaceJa: "マリ、トンブクトゥ",
    whyItMatters: "The epic of Sundiata was kept alive seven centuries almost entirely by trained memory — supremacy inherited from the griots.",
    whyItMattersJa: "スンジャータの叙事詩は七世紀ものあいだ、ほぼ鍛えられた記憶だけで生き続けた。覇はグリオから受け継がれる。",
    mentions: ["vo_luka", "vo_zoro", "ps_awaken"],
    body: {
      en: `Olamide's supremacy 覇 is inherited from the griots of the Mande world — the trained rememberers who kept the epic of Sundiata alive for seven centuries almost entirely by memory, a library with a heartbeat. He is the sea-sovereign of the Loanword's western waters, enormous, laughing, and utterly serious about exactly one thing.

When the Hush launched its last offensive against the unwritten — the epics, lineages, and oral scriptures that live only in minds — Olamide held Timbuktu as his ancestors held its manuscripts, which were literally smuggled to safety within living memory: by dispersal. Every keeper memorized a share, and the party itself became a library the Hush could not burn.`,
      ja: `オラミデの「覇」は、マンデ世界のグリオたちから受け継がれたものだ。鍛え抜かれた記憶者たちは、スンジャータの叙事詩を七世紀ものあいだ、ほぼ記憶だけで生かし続けた——鼓動を持つ図書館である。彼は借語号の西の海域を統べる海の王。巨躯で、笑い声が絶えず、そしてただ一つのことにだけ徹底して真剣だ。

静寂が「書かれざるもの」——叙事詩、系譜、心の中にのみ生きる口承の聖典——への最後の攻勢をかけたとき、オラミデは先祖が写本を守った方法でトンブクトゥを守った。あの写本群は、現代の記憶の内に、実際に密かに運び出されて救われたのだ。その方法とは分散である。守り手それぞれが一部を暗記し、一行そのものが、静寂には焼けない一つの図書館となった。`,
      romaji: `Oramide no "ha" wa, Mande sekai no gurio-tachi kara uketsugareta mono da. Kitaenukareta kiokusha-tachi wa, Sunjaata no jojishi o nana-seiki mono aida, hobo kioku dake de ikashitsuzuketa — kodou o motsu toshokan de aru. Kare wa Shakugo-gou no nishi no kaiiki o suberu umi no ou. Kyoku de, waraigoe ga taezu, soshite tada hitotsu no koto ni dake tettei shite shinken da.

Seijaku ga "kakarezaru mono" — jojishi, keifu, kokoro no naka ni nomi ikiru koushou no seiten — e no saigo no kousei o kaketa toki, Oramide wa senzo ga shahon o mamotta houhou de Tonbukutu o mamotta. Ano shahon-gun wa, gendai no kioku no uchi ni, jissai ni hisoka ni hakobidasarete sukuwareta no da. Sono houhou to wa bunsan de aru. Mamorite sorezore ga ichibu o anki shi, ikkou sono mono ga, Seijaku ni wa yakenai hitotsu no toshokan to natta.`,
    },
  },

  lu_hoshimi: {
    originPlace: "Manila, Philippines",
    originPlaceJa: "フィリピン、マニラ",
    whyItMatters: "Tala, goddess of stars, guides night travelers — and someone must keep the party's spirits lit through an apocalypse.",
    whyItMattersJa: "星の女神タラは夜行く者を導く。終末のさなか、一行の心を灯し続ける者も要るのだ。",
    mentions: ["lu_tsukina", "lu_venus", "ch_mocha"],
    body: {
      en: `Amaya is a star-guardian of the Sisterhood of Phases, born in Manila; her transformation invokes Tala, the Tagalog goddess of stars who guides night travelers home. The Sisterhood keeps the words of cycles — night, tide, love, return — the vocabulary of things that leave and come back, which the moon proves nightly.

She was the first of the sisterhood to find Sen, and she kept the early party alive in the simplest way: by the deliberate heresy of being fun during an apocalypse. In a war whose enemy wins by making people stop bothering, Amaya's cheerfulness is not decoration. It is Rule One, worn as a costume with ribbons.`,
      ja: `アマヤは相の姉妹の星の守り手であり、マニラに生まれた。彼女の変身は、夜行く者を家路へ導くタガログの星の女神タラを呼び起こす。姉妹団が守るのは循環の言葉——夜、潮、愛、帰還——去ってはまた戻るものたちの語彙であり、月が毎夜それを証明する。

センを最初に見つけた姉妹は彼女だった。そして彼女は最も単純な方法で序盤の一行を生かし続けた。終末のさなかに楽しくあるという、確信犯的な異端によってである。人々に「もうどうでもいい」と思わせることで勝つ敵との戦争において、アマヤの明るさは飾りではない。それはリボンの衣装を着た、掟の一条そのものだ。`,
      romaji: `Amaya wa Sou no Shimai no hoshi no mamorite de ari, Manira ni umareta. Kanojo no henshin wa, yoru yuku mono o ieji e michibiku Tagarogu no hoshi no megami Tara o yobiokosu. Shimaidan ga mamoru no wa junkan no kotoba — yoru, shio, ai, kikan — satte wa mata modoru mono-tachi no goi de ari, tsuki ga maiyo sore o shoumei suru.

Sen o saisho ni mitsuketa shimai wa kanojo datta. Soshite kanojo wa mottomo tanjun na houhou de joban no ikkou o ikashitsuzuketa. Shuumatsu no sanaka ni tanoshiku aru to iu, kakushinhan-teki na itan ni yotte de aru. Hitobito ni "mou dou demo ii" to omowaseru koto de katsu teki to no sensou ni oite, Amaya no akarusa wa kazari de wa nai. Sore wa ribon no ishou o kita, okite no ichijou sono mono da.`,
    },
  },

  lu_tsukina: {
    originPlace: "Aswan, Egypt",
    originPlaceJa: "エジプト、アスワン",
    whyItMatters: "Khonsu gambled moonlight to buy the calendar extra days — she cites it constantly: time itself is negotiable.",
    whyItMattersJa: "コンスは月光を賭けて暦に日々を買い足した。彼女は口癖のように引く——時間さえ交渉できるのだと。",
    mentions: ["re_zangetsu", "lu_hoshimi", "lu_queen"],
    body: {
      en: `Noor is the moon-sister from Aswan, sworn to Khonsu, the Egyptian moon-god whose name means "traveler" and who, in myth, gambled moonlight against the other gods to buy the calendar its five extra days. She cites this constantly, as legal precedent: time itself is negotiable, so despair is premature.

On the westward voyage she walked a moonlight road across black water where every chart had failed, Khonsu's crescent the road's source. When she finally met Kwame, the Reaper who also keeps 月, the two settled kindly who keeps which moon — he the mirror that shows the hollowed who they were, she the road that carries the living home.`,
      ja: `ヌールはアスワン出身の月の姉妹であり、エジプトの月神コンスに誓いを立てている。その名は「旅する者」を意味し、神話では他の神々を相手に月光を賭け、暦に五日の閏日を買い足した神である。彼女はこれを判例のように、口癖として引く。時間そのものが交渉可能なのだから、絶望は早計である、と。

西への航海で、あらゆる海図が用をなさなくなった黒い海の上、彼女は月光の道を歩いた。道の源はコンスの三日月だった。やがて同じ「月」を守る死神クワメと出会ったとき、二人はどちらがどの月を守るかを穏やかに取り決めた。彼は空ろにされた者にかつての姿を映す鏡を、彼女は生きる者を家へ運ぶ道を。`,
      romaji: `Nuuru wa Asuwan shusshin no tsuki no shimai de ari, Ejiputo no gesshin Konsu ni chikai o tateteiru. Sono na wa "tabi suru mono" o imi shi, shinwa de wa hoka no kamigami o aite ni gekkou o kake, koyomi ni itsuka no juujitsu o kaitashita kami de aru. Kanojo wa kore o hanrei no you ni, kuchiguse to shite hiku. Jikan sono mono ga koushou kanou na no dakara, zetsubou wa soukei de aru, to.

Nishi e no koukai de, arayuru kaizu ga you o nasanaku natta kuroi umi no ue, kanojo wa gekkou no michi o aruita. Michi no minamoto wa Konsu no mikazuki datta. Yagate onaji "tsuki" o mamoru shinigami Kuwame to deatta toki, futari wa dochira ga dono tsuki o mamoru ka o odayaka ni torikimeta. Kare wa utsuro ni sareta mono ni katsute no sugata o utsusu kagami o, kanojo wa ikiru mono o ie e hakobu michi o.`,
    },
  },

  lu_venus: {
    originPlace: "Lake Guatavita, Colombia",
    originPlaceJa: "コロンビア、グアタビータ湖",
    whyItMatters: "The conquistadors heard gold where the Muisca meant offering — mistranslation is the Hush's oldest ally, and love is the discipline of translating people correctly.",
    whyItMattersJa: "ムイスカが「捧げ物」と言ったところに、征服者は「黄金」を聞いた。誤訳は静寂の最古の盟友であり、愛とは人を正しく訳す修練である。",
    mentions: ["lu_hoshimi", "lu_queen", "sp_kama"],
    body: {
      en: `Camila keeps 愛 at Lake Guatavita — the sacred lake of the Muisca gold-offering rite that Spain mistranslated into "El Dorado." Her whole doctrine grows from that wound: the conquistadors heard gold where the Muisca meant offering, and centuries of ruin followed a single failed translation.

So her teaching, delivered in the steam of an Istanbul bathhouse to a party that badly needed it: mistranslation is the Hush's oldest ally, and love is the discipline of translating people correctly — hearing what was meant, not what was profitable to hear. Her heart-chain is a whip, but its real weapon is accuracy.`,
      ja: `カミラはグアタビータ湖で「愛」を守る。ムイスカの黄金奉納の儀の聖なる湖——スペインがそれを「エル・ドラード」と訳し違えた場所である。彼女の教義はすべて、その傷から育った。ムイスカが「捧げ物」と意味したところに征服者たちは「黄金」を聞き、たった一つの翻訳の失敗に、幾世紀の破滅が続いたのだ。

だから彼女の教えは、イスタンブールの浴場の湯気の中、それを切実に必要としていた一行へ説かれた。誤訳は静寂の最も古い盟友である。そして愛とは、人を正しく訳す修練である——聞いて得な言葉ではなく、意味された言葉を聞くこと。彼女の心の鎖は鞭だが、その真の武器は正確さだ。`,
      romaji: `Kamira wa Guatabiita-ko de "ai" o mamoru. Muisuka no ougon hounou no gi no seinaru mizuumi — Supein ga sore o "Eru Doraado" to yakuchigaeta basho de aru. Kanojo no kyougi wa subete, sono kizu kara sodatta. Muisuka ga "sasagemono" to imi shita tokoro ni seifukusha-tachi wa "ougon" o kiki, tatta hitotsu no hon'yaku no shippai ni, ikuseiki no hametsu ga tsuzuita no da.

Dakara kanojo no oshie wa, Isutanbuuru no yokujou no yuge no naka, sore o setsujitsu ni hitsuyou to shiteita ikkou e tokareta. Goyaku wa Seijaku no mottomo furui meiyuu de aru. Soshite ai to wa, hito o tadashiku yakusu shuuren de aru — kiite toku na kotoba de wa naku, imi sareta kotoba o kiku koto. Kanojo no kokoro no kusari wa muchi da ga, sono shin no buki wa seikakusa da.`,
    },
  },

  lu_queen: {
    originPlace: "The Moon, the world's memorial ledger",
    originPlaceJa: "月——世界の記名台帳",
    whyItMatters: "Every erased name lands in her register the moment it leaves the earth — even Mu's line is entered, blank.",
    whyItMattersJa: "消された名は地上を離れた瞬間、彼女の台帳に記される。ムーの行すら、空白のまま、確かに存在する。",
    mentions: ["nc_mu", "lu_tsukina", "sh_rookie"],
    body: {
      en: `Seraphine, the ethereal queen of the Sisterhood of Phases, keeps the register of the names of the dead — the moon as the world's memorial ledger, silver and exact. Every name the Hush has ever erased landed in her register the moment it left the earth. She has read them all.

Which is why the finale stands on her testimony: only Seraphine can verify that Mu's entry exists — blank, but entered. It was erased, so it has a line; it had no name, so the line is empty. That blank line is the legal proof that a name is owed, and after the war, Minjae's notebook of learned words enters her register beside the names of the dead: the ledger keeps beginnings now, too.`,
      ja: `相の姉妹の玲瓏たる女王セラフィーヌは、死者の名の台帳を守る。月とは世界の記名台帳——銀色で、厳密なものだ。静寂がこれまでに消したすべての名は、地上を離れた瞬間、彼女の台帳に記されてきた。彼女はそのすべてを読んでいる。

だからこそ結末は彼女の証言の上に立つ。ムーの記載が存在すること——空白のまま、しかし確かに記帳されていること——を検証できるのはセラフィーヌだけなのだ。消されたのだから行はある。名がなかったのだから行は空白である。その空白の一行こそ、名が負われているという法的証明だった。そして戦争のあと、ミンジェの学んだ言葉のノートが、死者の名と並んで彼女の台帳に納められる。台帳は今や、始まりも記すのである。`,
      romaji: `Sou no Shimai no reirou taru joou Serafiinu wa, shisha no na no daichou o mamoru. Tsuki to wa sekai no kimei daichou — gin'iro de, genmitsu na mono da. Seijaku ga kore made ni keshita subete no na wa, chijou o hanareta shunkan, kanojo no daichou ni shirusaretekita. Kanojo wa sono subete o yondeiru.

Dakara koso ketsumatsu wa kanojo no shougen no ue ni tatsu. Muu no kisai ga sonzai suru koto — kuuhaku no mama, shikashi tashika ni kichou sareteiru koto — o kenshou dekiru no wa Serafiinu dake na no da. Kesareta no dakara gyou wa aru. Na ga nakatta no dakara gyou wa kuuhaku de aru. Sono kuuhaku no ichigyou koso, na ga owareteiru to iu houteki shoumei datta. Soshite sensou no ato, Minje no mananda kotoba no nooto ga, shisha no na to narande kanojo no daichou ni osamerareru. Daichou wa ima ya, hajimari mo shirusu no de aru.`,
    },
  },

  ne_spike: {
    originPlace: "Lima, Peru",
    originPlaceJa: "ペルー、リマ",
    whyItMatters: "Illapa's voice was weather itself — and an unmeant word repeated a million times is a million open doors.",
    whyItMattersJa: "イリャパの声は天候そのものだった。そして百万回繰り返された意味なき言葉は、百万の開いた扉である。",
    mentions: ["ne_rebel", "ne_ghost", "nc_moku"],
    body: {
      en: `Diego is a street-tech from Lima, working under the garúa fog, wiring dead barrio signage back to life; his electricity 電 is sworn to Illapa, the Inca thunder-lord whose voice was weather itself — the original broadcast, and one that always meant what it said.

He was the first keeper to see the enemy's real beachhead. Not silence: noise. The Hush rides broadcasts — ads, feeds, slogans — because an unmeant word repeated a million times is a million open doors. Diego's war is fought sign by sign in the neon dark, relighting the letters people stopped reading, which is another way of asking them to mean their streets again.`,
      ja: `ディエゴはリマの路上技師である。ガルーアの霧の下、死んだ街区の看板に配線をやり直し、灯りを取り戻す。彼の「電」はインカの雷神イリャパ——その声は天候そのものであり、語ることを常に意味していた最初の放送——に誓われている。

敵の真の橋頭堡を最初に見抜いたのは彼だった。沈黙ではない。騒音だ。静寂は放送に乗る——広告に、フィードに、スローガンに。百万回繰り返された意味なき言葉は、百万の開いた扉だからである。ディエゴの戦争はネオンの闇の中、看板一枚ずつ戦われる。人々が読むのをやめた文字を灯し直すこと。それは、自分の街をもう一度意味してくれと頼む、もう一つの言い方なのだ。`,
      romaji: `Diego wa Rima no rojou gishi de aru. Garuua no kiri no shita, shinda gaiku no kanban ni haisen o yarinaoshi, akari o torimodosu. Kare no "den" wa Inka no raijin Iryapa — sono koe wa tenkou sono mono de ari, kataru koto o tsune ni imi shiteita saisho no housou — ni chikawareteiru.

Teki no shin no kyoutouho o saisho ni minuita no wa kare datta. Chinmoku de wa nai. Souon da. Seijaku wa housou ni noru — koukoku ni, fiido ni, suroogan ni. Hyakuman-kai kurikaesareta imi naki kotoba wa, hyakuman no hiraita tobira dakara de aru. Diego no sensou wa neon no yami no naka, kanban ichimai zutsu tatakawareru. Hitobito ga yomu no o yameta moji o tomoshinaosu koto. Sore wa, jibun no machi o mou ichido imi shitekure to tanomu, mou hitotsu no iikata na no da.`,
    },
  },

  ne_rebel: {
    originPlace: "St. Petersburg, Russia",
    originPlaceJa: "ロシア、サンクトペテルブルク",
    whyItMatters: "She stole her own name back from a Hush ledger as a child — the party's expert in what erasure feels like from inside.",
    whyItMattersJa: "幼い日、静寂の台帳から自分の名を盗み返した。消されるとはどういうことか、内側から知る唯一の者。",
    mentions: ["nc_kesu", "ne_spike", "me_asuka"],
    body: {
      en: `Anya is a night-runner from St. Petersburg, city of white-night summers where night itself half-vanishes — haunted, in the old Slavic way, by the Nocnitsa, the night-hag who steals sleep and speech from children. Something stole more than that from Anya: as a child, her name was entered in a Hush ledger, and she stole it back.

That makes her the party's expert in what erasure feels like from inside, and it made her invaluable at Byblos. On a night rooftop she recognized the Censor's ledger-script — the same hand her own crossed-out childhood entry was written in — and stole a page: the first hard intelligence of the war, naming "the Archivist" and a timetable keyed to a comet.`,
      ja: `アーニャはサンクトペテルブルクの夜駆けである。白夜の夏、夜そのものが半ば消え失せる都市——古いスラヴの流儀で言えば、子どもから眠りと言葉を盗む夜の魔女ノチニーツァに憑かれた街だ。だがアーニャから盗まれたのはそれ以上だった。幼い日、彼女の名は静寂の台帳に記された。そして彼女は、それを盗み返したのだ。

ゆえに彼女は、消されるとはどういうことかを内側から知る、一行でただ一人の専門家である。その経験がビブロスで戦局を動かした。夜の屋上で彼女は検閲官の台帳の筆跡に見覚えた——自分の抹消された幼年の記載と、同じ手であることに。そして一頁を盗んだ。戦争最初の確かな諜報であり、そこには「書庫官」の名と、彗星に合わせた時刻表が記されていた。`,
      romaji: `Aanya wa Sankutopeteruburuku no yogake de aru. Byakuya no natsu, yoru sono mono ga nakaba kieuseru toshi — furui Suravu no ryuugi de ieba, kodomo kara nemuri to kotoba o nusumu yoru no majo Nochiniitsa ni tsukareta machi da. Daga Aanya kara nusumareta no wa sore ijou datta. Osanai hi, kanojo no na wa Seijaku no daichou ni shirusareta. Soshite kanojo wa, sore o nusumikaeshita no da.

Yue ni kanojo wa, kesareru to wa dou iu koto ka o uchigawa kara shiru, ikkou de tada hitori no senmonka de aru. Sono keiken ga Biburosu de senkyoku o ugokashita. Yoru no okujou de kanojo wa Ken'etsukan no daichou no hisseki ni mioboeta — jibun no masshou sareta younen no kisai to, onaji te de aru koto ni. Soshite ichi-peeji o nusunda. Sensou saisho no tashika na chouhou de ari, soko ni wa "Shokokan" no na to, suisei ni awaseta jikokuhyou ga shirusareteita.`,
    },
  },

  ne_ghost: {
    originPlace: "Accra, Ghana",
    originPlaceJa: "ガーナ、アクラ",
    whyItMatters: "The kra, the soul-spark given by Nyame before birth, is the one bit of a person that cannot be erased.",
    whyItMattersJa: "生まれる前にニャメから授かる魂の火花クラは、人の中で唯一、消し得ないひと粒である。",
    mentions: ["re_zangetsu", "ne_titan", "ne_spike"],
    body: {
      en: `Kojo is a ghost-hacker from Accra; his zero 零 is grounded in the Akan concept of the kra, the soul-spark given by Nyame before birth — the irreducible bit of a person that no power can take, because it was issued by the sky itself. Kojo learned to reduce himself to exactly that: a single unerasable bit.

In that form he can walk Hush-dark strands of the Lattice that would strip anyone else to nothing. In the war's blackest hour, with White Noise jamming every frequency and the network severed around the drowned library, it was Kojo — a lone spark crossing a dead black web — who carried the party's plan through. He and Kwame are cousins: moon and zero, the two Akan keepers.`,
      ja: `コジョはアクラの幽霊ハッカーである。彼の「零」はアカンの概念クラ——生まれる前にニャメから授かる魂の火花、空そのものが発行したがゆえに、いかなる力にも奪えない、人の中の還元不能なひと粒——に根ざしている。コジョはまさにそれへと、自分自身を還元する術を学んだ。消し得ない、たった一ビットへと。

その姿でなら、他の誰であれ剥ぎ取られて無に帰すであろう、静寂に呑まれた闇の糸を渡ることができる。戦争の最も暗い時——ホワイトノイズが全周波数を妨害し、水底の書庫の周囲で網が断たれたとき——死んだ黒い網を渡る一粒の火花となって一行の作戦を届けたのは、コジョだった。彼とクワメは従兄弟である。月と零、二人のアカンの守り手だ。`,
      romaji: `Kojo wa Akura no yuurei hakkaa de aru. Kare no "rei" wa Akan no gainen kura — umareru mae ni Nyame kara sazukaru tamashii no hibana, sora sono mono ga hakkou shita ga yue ni, ikanaru chikara ni mo ubaenai, hito no naka no kangen funou na hitotsubu — ni nezashiteiru. Kojo wa masa ni sore e to, jibun jishin o kangen suru sube o mananda. Keshienai, tatta ichi-bitto e to.

Sono sugata de nara, hoka no dare de are hagitorarete mu ni kisu de arou, Seijaku ni nomareta yami no ito o wataru koto ga dekiru. Sensou no mottomo kurai toki — Howaito Noizu ga zen shuuhasuu o bougai shi, minasoko no shoko no shuui de ami ga tatareta toki — shinda kuroi ami o wataru hitotsubu no hibana to natte ikkou no sakusen o todoketa no wa, Kojo datta. Kare to Kuwame wa itoko de aru. Tsuki to rei, futari no Akan no mamorite da.`,
    },
  },

  ne_titan: {
    originPlace: "São Paulo, Brazil",
    originPlaceJa: "ブラジル、サンパウロ",
    whyItMatters: "No original body remains, and she still means every word — the walking refutation of the Hush's core claim.",
    whyItMattersJa: "元の肉体はひとかけらも残っていない。それでも彼女は一語一語を心から意味する。静寂の根本主張への、歩く反証である。",
    mentions: ["ne_ghost", "nc_mu", "ti_founder"],
    body: {
      en: `Bruna is a full-conversion cyborg from São Paulo: no original body remains, and she still means every word she says. That makes her the walking refutation of the Hush's core claim — that meaning needs an unbroken vessel, an unchanged origin, a pure line back to the first speaker. Steel 鋼 that chose its own name.

At Bhimbetka her nature became the mission: no flesh could survive the cold of the Unwritten Sea, where unmeaning strips warm things bare. So it was Bruna who physically carried the naming-brush down into the whiteness — chosen steel, carrying the instrument of the war's ending, meaning every step.`,
      ja: `ブルーナはサンパウロ出身の全身義体である。元の肉体はひとかけらも残っていない。それでも彼女は、口にする一語一語を心から意味する。それは静寂の根本主張——意味には切れ目なき器が、変わらぬ起源が、最初の話者まで遡る純粋な系譜が必要だという主張——への、歩く反証である。自らの名を自ら選んだ「鋼」だ。

ビンベットカでは、彼女の在り方そのものが任務となった。意味の失われた冷たさが温かいものを剥ぎ取ってしまう「書かれざる海」では、生身の肉体は生き延びられない。ゆえに命名の筆をあの白の中へ運び下ろしたのは、ブルーナだった。選ばれた鋼が、戦争を終わらせる道具を抱え、一歩一歩を意味しながら。`,
      romaji: `Buruuna wa Sanpauro shusshin no zenshin gitai de aru. Moto no nikutai wa hitokakera mo nokotteinai. Soredemo kanojo wa, kuchi ni suru ichigo ichigo o kokoro kara imi suru. Sore wa Seijaku no konpon shuchou — imi ni wa kireme naki utsuwa ga, kawaranu kigen ga, saisho no washa made sakanoboru junsui na keifu ga hitsuyou da to iu shuchou — e no, aruku hanshou de aru. Mizukara no na o mizukara eranda "hagane" da.

Binbettoka de wa, kanojo no arikata sono mono ga ninmu to natta. Imi no ushinawareta tsumetasa ga atatakai mono o hagitotte shimau "kakarezaru umi" de wa, namami no nikutai wa ikinobirarenai. Yue ni meimei no fude o ano shiro no naka e hakobioroshita no wa, Buruuna datta. Erabareta hagane ga, sensou o owaraseru dougu o kakae, ippo ippo o imi shinagara.`,
    },
  },

  he_anya: {
    originPlace: "Berlin, Germany",
    originPlaceJa: "ドイツ、ベルリン",
    whyItMatters: "She hears meaning directly, before words — the kindly version of what Mu is, and the only one who can hear its pain.",
    whyItMattersJa: "彼女は言葉になる前の意味をじかに聞く。ムーの優しい似姿であり、その痛みを聞き取れる唯一の者。",
    mentions: ["he_loid", "nc_mu", "sp_totomi"],
    body: {
      en: `Pip is the telepath child of the Kestrel House, a found-family of spies whose cover story became true. Their chosen home is Berlin — a city whose own wall fell within living memory, chosen for exactly that reason: the family knows walls come down, and kinship words can be built where they stood.

Pip hears meaning directly, pre-word — the kindly version of what Mu is — and is therefore the only being in the war who can hear the Hush's underneath: not hatred, but the pain of an unmeant word twelve hundred years long. It is Pip's line, spoken small at the edge of the Unwritten Sea, that unlocks the ending everyone else had only theorized.`,
      ja: `ピップはケストレル家のテレパスの子どもである。偽装のはずの家族がいつしか本物になった、諜報員たちの選ばれた家族だ。彼らが家に選んだのはベルリン——自らの壁が人々の記憶の内に崩れた都市であり、まさにその理由で選ばれた。壁は崩れるものであり、その跡地に血縁の言葉は築き直せるのだと、この家族は知っている。

ピップは言葉になる前の意味をじかに聞く。ムーの在り方の、優しい似姿である。ゆえにこの戦争で、静寂の底にあるものを聞き取れるのはピップだけだ。憎しみではない。千二百年続いた、意味されざる言葉の痛み。書かれざる海のほとりで小さく発せられたピップの一言こそが、誰もが理屈でしか知らなかった結末の扉を開けたのだった。`,
      romaji: `Pippu wa Kesutoreru-ke no terepasu no kodomo de aru. Gisou no hazu no kazoku ga itsushika honmono ni natta, chouhouin-tachi no erabareta kazoku da. Karera ga ie ni eranda no wa Berurin — mizukara no kabe ga hitobito no kioku no uchi ni kuzureta toshi de ari, masa ni sono riyuu de erabareta. Kabe wa kuzureru mono de ari, sono atochi ni ketsuen no kotoba wa kizukinaoseru no da to, kono kazoku wa shitteiru.

Pippu wa kotoba ni naru mae no imi o jika ni kiku. Muu no arikata no, yasashii nisugata de aru. Yue ni kono sensou de, Seijaku no soko ni aru mono o kikitoreru no wa Pippu dake da. Nikushimi de wa nai. Sen-nihyaku-nen tsuzuita, imi sarezaru kotoba no itami. Kakarezaru umi no hotori de chiisaku hasserareta Pippu no hitokoto koso ga, dare mo ga rikutsu de shika shiranakatta ketsumatsu no tobira o aketa no datta.`,
    },
  },

  he_loid: {
    originPlace: "Paris, France",
    originPlaceJa: "フランス、パリ",
    whyItMatters: "His fatherhood was forged for a mission — and relit the day Pip first called him papa off-script.",
    whyItMattersJa: "彼の父性は任務のための偽装だった。だが台本にない「パパ」をピップが初めて口にした日、その言葉は灯り直した。",
    mentions: ["he_anya", "he_yor", "he_bond"],
    body: {
      en: `Émile is a French spy who forged a family for a mission — and then refused to un-mean it. His kanji 父 was relit, strand and all, the day Pip first called him papa off-script: a word adopted, and still true. He is the saga's proof of Rule Four in miniature, and he knows it, and it embarrasses him at dinner parties.

When the Hush opened its kinship-word offensive — isolate families and let the words starve — Émile ran the safehouse where refugees who had lost the word for "home" were sheltered. There Pip heard their meaning still intact underneath the missing word, and the keystone of the whole finale was quietly set in a Paris kitchen.`,
      ja: `エミールはフランスの諜報員である。任務のために家族を偽造し——そして、その意味を取り消すことを拒んだ男だ。台本にない「パパ」をピップが初めて口にした日、彼の「父」の字は、糸ごと灯り直した。あとから選ばれ、それでもなお真実である言葉。彼は掟の四条の生きた縮図であり、本人もそれを知っていて、晩餐の席ではいつも決まりが悪そうにしている。

静寂が血縁語への攻勢を開いたとき——家族を孤立させ、言葉を飢えさせる戦法だ——エミールは「家」という言葉を失った難民たちを匿う隠れ家を営んだ。そこでピップは、失われた言葉の下に意味がまだ無傷で残っていることを聞き取った。物語全体の結末を支える要石は、パリの台所で、静かに据えられたのである。`,
      romaji: `Emiiru wa Furansu no chouhouin de aru. Ninmu no tame ni kazoku o gizou shi — soshite, sono imi o torikesu koto o kobanda otoko da. Daihon ni nai "papa" o Pippu ga hajimete kuchi ni shita hi, kare no "chichi" no ji wa, ito goto tomorinaoshita. Ato kara erabare, soredemo nao shinjitsu de aru kotoba. Kare wa okite no yonjou no ikita shukuzu de ari, honnin mo sore o shitteite, bansan no seki de wa itsumo kimari ga warusou ni shiteiru.

Seijaku ga ketsuengo e no kousei o hiraita toki — kazoku o koritsu sase, kotoba o uesaseru senpou da — Emiiru wa "ie" to iu kotoba o ushinatta nanmin-tachi o kakumau kakurega o itonanda. Soko de Pippu wa, ushinawareta kotoba no shita ni imi ga mada mukizu de nokotteiru koto o kikitotta. Monogatari zentai no ketsumatsu o sasaeru kanameishi wa, Pari no daidokoro de, shizuka ni suerareta no de aru.`,
    },
  },

  he_yor: {
    originPlace: "Mardin, Turkey",
    originPlaceJa: "トルコ、マルディン",
    whyItMatters: "Şahmeran was betrayed by the human she loved — Leyla chooses to read it as a warning, not a rule.",
    whyItMattersJa: "シャフメランは愛した人間に裏切られた。レイラはそれを掟ではなく、戒めとして読むことを選ぶ。",
    mentions: ["he_loid", "sp_kama", "he_anya"],
    body: {
      en: `Leyla is the assassin-homemaker of the Kestrel House, from Mardin, sworn to Şahmeran — the serpent-queen of Anatolian legend, betrayed by the beloved human she trusted. Leyla chooses to read that story as a warning, not a rule: trust is dangerous, and she extends it anyway, nightly, over dinner.

Her needle 刺 kills or embroiders; she has decided which by dinner every night for years. It was Leyla who brought the party to Grandfather Ash's bathhouse — she had been quietly gathering intelligence in its steam for a decade — and so it is Leyla, in a real sense, who made possible the memory-thread that later brought Halime home.`,
      ja: `レイラはケストレル家の暗殺者にして主婦であり、マルディンの出である。アナトリアの伝説の蛇の女王シャフメラン——信じた最愛の人間に裏切られた女王——に誓いを立てている。レイラはその物語を、掟ではなく戒めとして読むことを選ぶ。信頼は危うい。それでも彼女は毎晩、夕食の席で、信頼を差し出すのだ。

彼女の「刺」は、殺しもすれば刺繍もする。どちらにするかを、彼女は何年ものあいだ、毎晩夕食までに決めてきた。一行をグランドファーザー・アッシュの浴場へ導いたのはレイラである。彼女は十年、その湯気の中で静かに諜報を集めていた。だから、のちにハリメを家へ連れ戻すことになる記憶の糸を可能にしたのは——実のところ、レイラなのだ。`,
      romaji: `Reira wa Kesutoreru-ke no ansatsusha ni shite shufu de ari, Marudin no shutsu de aru. Anatoria no densetsu no hebi no joou Shafumeran — shinjita saiai no ningen ni uragirareta joou — ni chikai o tateteiru. Reira wa sono monogatari o, okite de wa naku imashime to shite yomu koto o erabu. Shinrai wa ayaui. Soredemo kanojo wa maiban, yuushoku no seki de, shinrai o sashidasu no da.

Kanojo no "shi" wa, koroshi mo sureba shishuu mo suru. Dochira ni suru ka o, kanojo wa nannen mono aida, maiban yuushoku made ni kimetekita. Ikkou o Gurandofaazaa Asshu no yokujou e michibiita no wa Reira de aru. Kanojo wa juunen, sono yuge no naka de shizuka ni chouhou o atsumeteita. Dakara, nochi ni Harime o ie e tsuremodosu koto ni naru kioku no ito o kanou ni shita no wa — jitsu no tokoro, Reira na no da.`,
    },
  },

  he_bond: {
    originPlace: "The Kestrel House, Berlin",
    originPlaceJa: "ベルリン、ケストレルの家",
    whyItMatters: "He sees the future only along lit strands — his blind spots, plotted on a chart, spelled out where the war would end.",
    whyItMattersJa: "彼が見通せるのは灯る糸の先だけ。その死角を海図に記すと、戦争の終わる場所が綴られた。",
    mentions: ["ti_hana", "he_anya", "sh_knight"],
    body: {
      en: `Biscuit is the precognitive dog of the Kestrel House, and his gift has a lawful limit: he sees forward only along lit strands of the Lattice. The future of anything the Hush has taken is simply invisible to him — a blankness where foresight should be, which for most of the war looked like a flaw.

It was the war's finest intelligence coup. Plot the blind spots on Zola's aerial charts, the party realized, and the gaps themselves draw a map of the enemy's plan. Biscuit's inked-in blindness, laid over the surveyed Lattice, spelled out Bhimbetka — where marks began, where the Mouth would open. A very good dog whose one trick won the intelligence battle of the age.`,
      ja: `ビスケットはケストレル家の予知能力を持つ犬である。その力には法則どおりの限界がある。彼が先を見通せるのは、格子の灯っている糸に沿ってだけだ。静寂に奪われたものの未来は、彼にはまったく見えない。予見のあるべき場所に空白が広がる——戦争の大半のあいだ、それは欠陥に見えていた。

だがそれこそが、この戦争で最も見事な諜報の一手となった。ゾラの空撮海図の上にその死角を書き込めば、空白そのものが敵の計画の地図を描くと、一行は気づいたのだ。測量された格子の上に重ねられたビスケットの「見えなさ」は、ビンベットカという地名を綴った。印の始まった場所、「口」の開かれる場所である。たった一芸で時代の諜報戦を制した、とても良い犬だ。`,
      romaji: `Bisuketto wa Kesutoreru-ke no yochi nouryoku o motsu inu de aru. Sono chikara ni wa housoku doori no genkai ga aru. Kare ga saki o mitooseru no wa, koushi no tomotteiru ito ni sotte dake da. Seijaku ni ubawareta mono no mirai wa, kare ni wa mattaku mienai. Yoken no aru beki basho ni kuuhaku ga hirogaru — sensou no taihan no aida, sore wa kekkan ni mieteita.

Daga sore koso ga, kono sensou de mottomo migoto na chouhou no itte to natta. Zora no kuusatsu kaizu no ue ni sono shikaku o kakikomeba, kuuhaku sono mono ga teki no keikaku no chizu o egaku to, ikkou wa kizuita no da. Sokuryou sareta koushi no ue ni kasanerareta Bisuketto no "mienasa" wa, Binbettoka to iu chimei o tsuzutta. Shirushi no hajimatta basho, "Kuchi" no hirakareru basho de aru. Tatta ichigei de jidai no chouhousen o seishita, totemo yoi inu da.`,
    },
  },

  ps_mob: {
    originPlace: "Tokyo, Japan",
    originPlaceJa: "日本、東京",
    whyItMatters: "In kotodama's home country, words do things — so the boy holding too much barely speaks at all.",
    whyItMattersJa: "言霊の国では、言葉は現実を動かす。だからあまりに多くを抱えた少年は、ほとんど口をきかない。",
    mentions: ["ps_awaken", "nc_moku", "ps_dimple"],
    body: {
      en: `Haru is a Tokyo schoolboy holding more 気 than any vessel should, and he is terrified of what he would mean if he ever said everything. Kotodama's home country gives him his burden its exact shape: in Japan, words do things — speaking a word with intent exerts real force — so the boy with the most to say barely speaks.

He is Sen's closest mirror among the keepers: both carry power that only works when meant. Haru walked most of the route from Varanasi silent, saving one sentence. The city of static would eventually demand it of him — but that is the story of his awakening, and for eight chapters he simply, heroically, holds.`,
      ja: `ハルは、どんな器にも余るほどの「気」を抱えた東京の学生である。もしすべてを口にしたら自分が何を意味してしまうのか——それが恐ろしい。言霊の国は、彼の重荷に正確な形を与えている。日本では言葉は現実を動かす。意志を込めて発された言葉は本当の力を及ぼす。だから、最も語るべきものを持つ少年が、ほとんど口をきかないのだ。

守り手たちの中で、彼はセンに最も近い鏡である。二人とも、心から意味したときにだけ働く力を抱えている。ハルはヴァラナシからの道のりの大半を沈黙のまま歩き、たった一つの文を取っておいた。やがて雑音の都がそれを彼に要求する——だがそれは彼の覚醒の物語だ。八つの章のあいだ、彼はただ、英雄的に、持ちこたえる。`,
      romaji: `Haru wa, donna utsuwa ni mo amaru hodo no "ki" o kakaeta Toukyou no gakusei de aru. Moshi subete o kuchi ni shitara jibun ga nani o imi shite shimau no ka — sore ga osoroshii. Kotodama no kuni wa, kare no omoni ni seikaku na katachi o ataeteiru. Nihon de wa kotoba wa genjitsu o ugokasu. Ishi o komete hasserareta kotoba wa hontou no chikara o oyobosu. Dakara, mottomo kataru beki mono o motsu shounen ga, hotondo kuchi o kikanai no da.

Mamorite-tachi no naka de, kare wa Sen ni mottomo chikai kagami de aru. Futari tomo, kokoro kara imi shita toki ni dake hataraku chikara o kakaeteiru. Haru wa Varanashi kara no michinori no taihan o chinmoku no mama aruki, tatta hitotsu no bun o totteoita. Yagate zatsuon no miyako ga sore o kare ni youkyuu suru — daga sore wa kare no kakusei no monogatari da. Yattsu no shou no aida, kare wa tada, eiyuu-teki ni, mochikotaeru.`,
    },
  },

  ps_dimple: {
    originPlace: "The alleys of Tokyo",
    originPlaceJa: "東京の路地裏",
    whyItMatters: "Being remembered as a nuisance still counts as being remembered — the rulebook, stress-tested and openly proud of it.",
    whyItMattersJa: "迷惑として覚えられていても、覚えられていることに変わりはない。掟の穴を突いて生き延び、堂々と誇っている。",
    mentions: ["ps_mob", "ps_reigen", "ch_mocha"],
    body: {
      en: `Blip is a mischievous spirit blob — a low-rent yōkai of Tokyo's alleys who made the discovery of a scoundrel's lifetime: being remembered as a nuisance still counts as being remembered. Rule Three, which keeps the great keepers alive through love, keeps Blip alive through petty grudges, and Blip is openly, radiantly proud of this.

The party's rulebook needed a stress test, and Blip is it: comic relief that doubles as jurisprudence. Every scam it survives proves the Lattice's law holds at the bottom of the scale as surely as at the top — a truth that matters enormously when, much later, the war turns on what the rules owe even to the Hush.`,
      ja: `ブリップは悪戯好きの霊の塊——東京の路地裏に棲む安手の妖怪であり、ならず者として一世一代の発見をした。迷惑として覚えられていても、覚えられていることに変わりはない、という発見である。偉大な守り手たちを愛によって生かす掟の三条は、ブリップを些細な恨みによって生かしている。そして本人はこれを、堂々と、輝かんばかりに誇っているのだ。

一行の掟には耐久試験が必要だった。ブリップこそがそれである。法理学を兼ねた道化だ。ブリップが生き延びるいかがわしい一件一件が、格子の法は序列の底辺でも頂点と同じく確かに働くことを証明する。この真実は、はるかのちに、掟が静寂にさえ何を負うのかに戦争の帰趨がかかったとき、途方もなく重要になる。`,
      romaji: `Burippu wa itazurazuki no rei no katamari — Toukyou no rojiura ni sumu yasude no youkai de ari, narazumono to shite issei ichidai no hakken o shita. Meiwaku to shite oboerareteite mo, oboerareteiru koto ni kawari wa nai, to iu hakken de aru. Idai na mamorite-tachi o ai ni yotte ikasu okite no sanjou wa, Burippu o sasai na urami ni yotte ikashiteiru. Soshite honnin wa kore o, doudou to, kagayakan bakari ni hokotteiru no da.

Ikkou no okite ni wa taikyuu shiken ga hitsuyou datta. Burippu koso ga sore de aru. Hourigaku o kaneta douke da. Burippu ga ikinobiru ikagawashii ikken ikken ga, koushi no hou wa joretsu no teihen demo chouten to onajiku tashika ni hataraku koto o shoumei suru. Kono shinjitsu wa, haruka nochi ni, okite ga Seijaku ni sae nani o ou no ka ni sensou no kisuu ga kakatta toki, tohou mo naku juuyou ni naru.`,
    },
  },

  ps_reigen: {
    originPlace: "Lagos, Nigeria",
    originPlaceJa: "ナイジェリア、ラゴス",
    whyItMatters: "Èṣù deals in messages, not truths — and a lie meant kindly is still meant, to the con man's own theological horror.",
    whyItMattersJa: "エシュが扱うのは真実ではなく言伝である。優しさから発された嘘もまた意味されている——詐欺師本人の神学的恐怖をよそに。",
    mentions: ["cu_rei", "sl_kagura", "ps_dimple"],
    body: {
      en: `Baba Kunle is a Lagos "psychic," a fraud, and — entirely by accident — priest-adjacent of Èṣù, the Yoruba orisha of crossroads, messages, and productive misunderstanding. His con is simple and ancient: he tells people what they need to hear. The war detonated a theological grenade under it: the Hush cannot feed on his patter, because a lie meant kindly is still meant.

Rule One protects a warm-hearted fraud, to his own horror. And it was Kunle, of all people, who broke the doubt-siege of Lalibela: a con man knows exactly how doubt is installed, so he uninstalled it, chanter by chanter, until Amara could ring the great bell. His estranged nephew Idris forgave him under the crossroads' four-way shadow.`,
      ja: `ババ・クンレはラゴスの「霊能者」であり、食わせ者であり——まったくの偶然によって——辻と言伝と実り多き誤解のオリシャ、エシュの司祭めいた何かである。彼の商売は単純で、古い。人々に、その人が必要としている言葉を告げるのだ。戦争はその足元で神学の手榴弾を炸裂させた。静寂は彼の口上を糧にできない。優しさから発された嘘もまた、意味されているからである。

掟の一条が、心の温かい食わせ者を守る——本人の恐怖をよそに。そしてラリベラの疑いの包囲を破ったのは、よりにもよってクンレだった。詐欺師は疑いの植え付け方を知り尽くしている。ゆえに、その取り除き方も知っているのだ。歌い手ひとりずつ疑いを外していき、ついにアマラが大鐘を鳴らした。疎遠だった甥イドリスは、辻の四方に伸びる影の下で彼を赦した。`,
      romaji: `Baba Kunre wa Ragosu no "reinousha" de ari, kuwasemono de ari — mattaku no guuzen ni yotte — tsuji to kotozute to minori ooki gokai no orisha, Eshu no shisai meita nanika de aru. Kare no shoubai wa tanjun de, furui. Hitobito ni, sono hito ga hitsuyou to shiteiru kotoba o tsugeru no da. Sensou wa sono ashimoto de shingaku no shuryuudan o sakuretsu saseta. Seijaku wa kare no koujou o kate ni dekinai. Yasashisa kara hasserareta uso mo mata, imi sareteiru kara de aru.

Okite no ichijou ga, kokoro no atatakai kuwasemono o mamoru — honnin no kyoufu o yoso ni. Soshite Raribera no utagai no houi o yabutta no wa, yori ni yotte Kunre datta. Sagishi wa utagai no uetsukekata o shiritsukushiteiru. Yue ni, sono torinozokikata mo shitteiru no da. Utaite hitori zutsu utagai o hazushite iki, tsui ni Amara ga oogane o narashita. Soen datta oi Idorisu wa, tsuji no shihou ni nobiru kage no shita de kare o yurushita.`,
    },
  },

  ps_awaken: {
    originPlace: "The Konkan coast, India",
    originPlaceJa: "インド、コンカン海岸",
    whyItMatters: "The awakening was not an explosion but its opposite: one complete, unfiltered, meant sentence.",
    whyItMattersJa: "覚醒は爆発ではなく、その正反対だった。完全で、包み隠さず、心から意味された、たった一つの文である。",
    mentions: ["ps_mob", "nc_moku", "po_legend"],
    body: {
      en: `On the Konkan coast, in the last offensive before the comet, White Noise finally showed Haru the thing he had feared his whole life: a city of people speaking without meaning — everything he was terrified he might be. The static was total; every frequency drowned; the oral scriptures themselves under assault.

And the awakening 覚 was not an explosion. It was the opposite. Haru said, out loud, exactly what he felt — once, completely, the unfiltered meant sentence of a lifetime — and the static shattered like glass at a struck tuning fork's note. One page, one bubble, and the coast silent around it. The boy who held everything learned that holding was never the assignment; meaning was.`,
      ja: `コンカン海岸、彗星到来前の最後の攻勢で、ホワイトノイズはついにハルに、彼が生涯恐れてきたものを見せつけた。誰もが語り、誰も意味していない都市——自分がそうなってしまうのではと怯え続けた、その姿そのものを。静電気は全てを覆い、あらゆる周波数が溺れ、口承の聖典そのものが攻撃に晒されていた。

そして「覚」の覚醒は、爆発ではなかった。その正反対だった。ハルは感じていることを、そのまま、声に出して言った——一度だけ、完全に。生涯にただ一つの、包み隠さず意味された文である。すると静電気は、打たれた音叉の音に触れたガラスのように砕け散った。一頁、一つの吹き出し、そして静まり返る海岸。すべてを抱え込んできた少年は知った。抱えることは課題ではなかった。意味することが、課題だったのだ。`,
      romaji: `Konkan kaigan, suisei tourai mae no saigo no kousei de, Howaito Noizu wa tsui ni Haru ni, kare ga shougai osoretekita mono o misetsuketa. Dare mo ga katari, dare mo imi shiteinai toshi — jibun ga sou natte shimau no de wa to obietsuzuketa, sono sugata sono mono o. Seidenki wa subete o ooi, arayuru shuuhasuu ga obore, koushou no seiten sono mono ga kougeki ni sarasareteita.

Soshite "kaku" no kakusei wa, bakuhatsu de wa nakatta. Sono seihantai datta. Haru wa kanjiteiru koto o, sono mama, koe ni dashite itta — ichido dake, kanzen ni. Shougai ni tada hitotsu no, tsutsumikakusazu imi sareta bun de aru. Suruto seidenki wa, utareta onsa no oto ni fureta garasu no you ni kudakechitta. Ichi-peeji, hitotsu no fukidashi, soshite shizumarikaeru kaigan. Subete o kakaekondekita shounen wa shitta. Kakaeru koto wa kadai de wa nakatta. Imi suru koto ga, kadai datta no da.`,
    },
  },

  me_shin: {
    originPlace: "The Harz mountains, Germany",
    originPlaceJa: "ドイツ、ハルツ山地",
    whyItMatters: "The Brocken spectre — your own vast shadow walking the fog — has always been feared as a herald; his shadow arrives before he does.",
    whyItMattersJa: "霧を歩く自分自身の巨大な影、ブロッケン現象は古来より先触れとして恐れられた。彼の影は、彼より先に着く。",
    mentions: ["me_asuka", "me_unit", "me_angel"],
    body: {
      en: `Elias is a pilot of the Threshold Program, from the Harz mountains, his call-sign taken from the Brocken spectre — the real optical phenomenon in which your own vast shadow walks the fog ahead of you, feared in folklore for centuries as a herald of things to come.

He is the program's herald 使 in fact as well as name: first contact with every Pattern-fragment falls to him, and his own shadow always arrives before he does — a giant bowing in the fog before a frightened teenager steps out of it. The Threshold Program's question is his own: when the vessel meets what comes from outside language, do the words speak us?`,
      ja: `エリアスは境界計画の操縦士であり、ハルツ山地の出である。コールサインはブロッケン現象から取られた。霧の中、自分自身の巨大な影が先に立って歩く実在の光学現象——何世紀にもわたり、来たるものの先触れとして恐れられてきたものだ。

彼は名実ともに計画の先触れ「使」である。パターンの断片との最初の接触はすべて彼の役目であり、そして彼の影は常に、彼自身より先に着く。怯えた少年が霧から歩み出るその前に、巨人が霧の中で一礼するのだ。境界計画の問いは、そのまま彼自身の問いである。言語の外から来るものと器が出会うとき——言葉が、我々を語るのではないか?`,
      romaji: `Eriasu wa Kyoukai Keikaku no soujuushi de ari, Harutsu sanchi no shutsu de aru. Kooru sain wa Burokken genshou kara torareta. Kiri no naka, jibun jishin no kyodai na kage ga saki ni tatte aruku jitsuzai no kougaku genshou — nanseiki ni mo watari, kitaru mono no sakibure to shite osorerarete kita mono da.

Kare wa meijitsu tomo ni keikaku no sakibure "shi" de aru. Pataan no danpen to no saisho no sesshoku wa subete kare no yakume de ari, soshite kare no kage wa tsune ni, kare jishin yori saki ni tsuku. Obieta shounen ga kiri kara ayumideru sono mae ni, kyojin ga kiri no naka de ichirei suru no da. Kyoukai Keikaku no toi wa, sono mama kare jishin no toi de aru. Gengo no soto kara kuru mono to utsuwa ga deau toki — kotoba ga, wareware o kataru no de wa nai ka?`,
    },
  },

  me_asuka: {
    originPlace: "Byblos, Lebanon",
    originPlaceJa: "レバノン、ビブロス",
    whyItMatters: "Her city gave the alphabet to the Greeks and its name to the book itself — she holds the line at the root of every Western letterform.",
    whyItMattersJa: "彼女の街はギリシャに文字を与え、「書物」にその名を与えた。彼女は西方のあらゆる文字の根で戦線を支える。",
    mentions: ["me_shin", "ne_rebel", "cu_maki"],
    body: {
      en: `Rania is a pilot from Byblos — the city that gave the alphabet to the Greeks and its very name to the book, biblio-, every library on earth carrying a syllable of her home. Her crimson 紅 is the Tyrian murex dye her Phoenician ancestors traded alongside letters, cargo and color and alphabet on the same ships.

When the Censor struck at the root — erase the memory that letters were invented, and every alphabet becomes unmeant marks — the defense of the birthplace fell to her. Rania held the line among her own ruins, the twenty-two Phoenician letters glowing on old stones like embers under ash, and the root held.`,
      ja: `ラニアはビブロス出身の操縦士である。ギリシャ人にアルファベットを与え、「書物(ビブリオ)」にその名そのものを与えた街——地上のすべての図書館が、彼女の故郷の一音を運んでいる。彼女の「紅」は、フェニキアの祖先が文字とともに商ったティルスの貝紫だ。積み荷と色彩と文字とが、同じ船で運ばれたのである。

検閲官が根を打ったとき——「文字が発明された」という記憶を消せば、あらゆるアルファベットは意味なき刻み目に堕ちる——生誕の地の防衛は彼女に託された。ラニアは自らの故郷の廃墟の中で戦線を支えた。二十二のフェニキア文字が、灰の下の熾火のように古い石の上に灯り——そして根は、持ちこたえた。`,
      romaji: `Rania wa Biburosu shusshin no soujuushi de aru. Girisha-jin ni arufabetto o atae, "shomotsu (biburio)" ni sono na sono mono o ataeta machi — chijou no subete no toshokan ga, kanojo no kokyou no ichion o hakondeiru. Kanojo no "beni" wa, Fenikia no sosen ga moji to tomo ni akinatta Tirusu no kaimurasaki da. Tsumini to shikisai to moji to ga, onaji fune de hakobareta no de aru.

Ken'etsukan ga ne o utta toki — "moji ga hatsumei sareta" to iu kioku o keseba, arayuru arufabetto wa imi naki kizamime ni ochiru — seitan no chi no bouei wa kanojo ni takusareta. Rania wa mizukara no kokyou no haikyo no naka de sensen o sasaeta. Nijuuni no Fenikia moji ga, hai no shita no okibi no you ni furui ishi no ue ni tomori — soshite ne wa, mochikotaeta.`,
    },
  },

  me_unit: {
    originPlace: "A river testing ground, Japan",
    originPlaceJa: "日本、河川の試験場",
    whyItMatters: "Bow to a kappa and it must bow back — a weapon that can only counter, never strike first, is the only weapon pilots trust.",
    whyItMattersJa: "河童に頭を下げれば、河童も下げ返さねばならない。反撃しかできず先手を打てない兵器だけを、操縦士たちは信じる。",
    mentions: ["me_shin", "me_asuka", "me_angel"],
    body: {
      en: `Unit Kappa is the Threshold Program's bio-mecha test type, grown around a kappa — the Japanese river yokai who is compulsively polite: bow to a kappa and it must bow back, spilling the water that is its strength. The engineers did not remove the courtesy. They built the weapon around it.

Unit Kappa's zero 零 discharge works exactly as the folklore does: it can only counter, never initiate — Rule One's ethics cast in armor plate. The Hush cannot bait it, commanders cannot misuse it, and pilots trust it precisely because it cannot strike first. In a war where every real battle is a siege of morale, a weapon incapable of aggression turned out to be the safest thing in the sky.`,
      ja: `ユニット・カッパは境界計画の生体機械試作型であり、河童——強迫的なまでに礼儀正しい日本の川の妖怪——を核として培養された。河童に頭を下げれば、河童も下げ返さねばならず、その力の源である皿の水がこぼれる。技師たちはその礼儀を取り除かなかった。その礼儀を中心に、兵器を組み上げたのだ。

ユニット・カッパの「零」の放電は、伝承とまったく同じに働く。反撃しかできず、けっして先手を打てない——掟の一条の倫理を装甲板に鋳込んだものである。静寂はこれを挑発できず、指揮官はこれを悪用できず、操縦士たちは、先に斬りかかれないからこそ、これを信じる。すべての戦闘が士気の攻城戦であるこの戦争で、攻撃の不可能な兵器こそが、空で最も安全なものだったのだ。`,
      romaji: `Yunitto Kappa wa Kyoukai Keikaku no seitai kikai shisakugata de ari, kappa — kyouhaku-teki na made ni reigi tadashii Nihon no kawa no youkai — o kaku to shite baiyou sareta. Kappa ni atama o sagereba, kappa mo sagekaesaneba narazu, sono chikara no minamoto de aru sara no mizu ga koboreru. Gishi-tachi wa sono reigi o torinozokanakatta. Sono reigi o chuushin ni, heiki o kumiageta no da.

Yunitto Kappa no "rei" no houden wa, denshou to mattaku onaji ni hataraku. Hangeki shika dekizu, kesshite sente o utenai — okite no ichijou no rinri o soukouban ni ikonda mono de aru. Seijaku wa kore o chouhatsu dekizu, shikikan wa kore o akuyou dekizu, soujuushi-tachi wa, saki ni kirikakarenai kara koso, kore o shinjiru. Subete no sentou ga shiki no koujousen de aru kono sensou de, kougeki no fukanou na heiki koso ga, sora de mottomo anzen na mono datta no da.`,
    },
  },

  me_angel: {
    originPlace: "The high sky above the Pacific",
    originPlaceJa: "太平洋上空の高み",
    whyItMatters: "Not a god of language but grammar itself, self-aware — it lends the finale a grammatical slot where a new name can legally live.",
    whyItMattersJa: "言語の神ではなく、自我を持った文法そのもの。結末に、新しい名が合法に宿れる文法の空欄を貸し与える。",
    mentions: ["ho_comet", "he_anya", "nc_mu"],
    body: {
      en: `The Pattern is a geometric angelic entity: not a god of language but grammar itself, self-aware — the structure that exists whether or not anyone speaks. It has watched the Hush for twelve centuries with something like sibling rivalry, for erasure and syntax are both older than any word.

On the flight to meet the comet, it tested the fellowship in the one language it speaks: structure. It swapped the party's voices, grammar, and pronouns, and watched whether meaning survived translation into pure form. Pip passed for everyone — meaning, heard directly, does not move when the words do. Satisfied, The Pattern lent the finale the one thing only grammar can give: an empty slot, a place in language where a new name could legally live.`,
      ja: `パターンは幾何学的な天使体である。言語の神ではなく、自我を持った文法そのもの——誰かが語ろうと語るまいと存在する構造だ。それは十二世紀のあいだ、同胞への対抗心にも似たものを抱いて静寂を見守ってきた。消去と統語は、どちらも、いかなる言葉よりも古いのだから。

彗星へ向かう飛行の途上、それは自らの話せる唯一の言語——構造——で一行の絆を試した。声を、文法を、代名詞を入れ替え、意味が純粋な形式への翻訳を生き延びるかを見つめたのだ。ピップが全員の分を通過させた。じかに聞かれる意味は、言葉が動いても動かない。得心したパターンは、文法だけが与えうるただ一つのものを結末に貸した。空の枠——新しい名が合法に宿れる、言語の中の場所である。`,
      romaji: `Pataan wa kikagaku-teki na tenshitai de aru. Gengo no kami de wa naku, jiga o motta bunpou sono mono — dareka ga katarou to kataru mai to sonzai suru kouzou da. Sore wa juuni-seiki no aida, harakara e no taikoushin ni mo nita mono o idaite Seijaku o mimamottekita. Shoukyo to tougo wa, dochira mo, ikanaru kotoba yori mo furui no dakara.

Suisei e mukau hikou no tojou, sore wa mizukara no hanaseru yuiitsu no gengo — kouzou — de ikkou no kizuna o tameshita. Koe o, bunpou o, daimeishi o irekae, imi ga junsui na keishiki e no hon'yaku o ikinobiru ka o mitsumeta no da. Pippu ga zen'in no bun o tsuuka saseta. Jika ni kikareru imi wa, kotoba ga ugoite mo ugokanai. Tokushin shita Pataan wa, bunpou dake ga ataeuru tada hitotsu no mono o ketsumatsu ni kashita. Kara no waku — atarashii na ga gouhou ni yadoreru, gengo no naka no basho de aru.`,
    },
  },

  ho_taki: {
    originPlace: "Busan, South Korea",
    originPlaceJa: "韓国、釜山",
    whyItMatters: "Once a year the cowherd and weaver stars cross the Milky Way on a bridge of magpies — he keeps the sky-words of everyone waiting.",
    whyItMattersJa: "牽牛と織女の星は年に一度、かささぎの橋で天の川を渡る。彼は誰かを待つすべての人の空の言葉を守る。",
    mentions: ["sp_ohtori", "ho_mitsu", "ho_rain"],
    body: {
      en: `Jun is a sky-keeper from Busan, raised on the tale of Gyeonwoo and Jiknyeo — the cowherd and the weaver stars, lovers set on opposite banks of the Milky Way, who cross to each other once a year on a bridge of magpies. The Far-Apart keep the vocabulary of distance and longing, and Jun keeps its sky.

His 空 is the sky between people — the up-look of everyone waiting for someone — and he and Nayeli of Teotihuacan split the word without conflict: hers is the sky beneath wings. On the voyage he charted which sky-strands still stood, golden-hour work done at every port, because a connection is proven by the ache of its stretch.`,
      ja: `ジュンは釜山出身の空の守り手であり、牽牛と織女の物語——天の川の両岸に引き裂かれ、年に一度、かささぎの橋を渡って会う恋人星たち——に育てられた。遠距離の一族は距離と憧憬の語彙を守り、ジュンはその空を守る。

彼の「空」は人と人のあいだの空——誰かを待つすべての人の見上げる先——である。テオティワカンのナイェリとこの字を争いなく分け合った。彼女のものは翼の下の空だ。航海のあいだ、彼はどの空の糸がまだ立っているかを、港ごとに黄金色の時刻に測り続けた。つながりというものは、引き伸ばされた痛みによってこそ証明されるのだから。`,
      romaji: `Jun wa Pusan shusshin no sora no mamorite de ari, Ken'gyuu to Shokujo no monogatari — Ama-no-gawa no ryougan ni hikisakare, nen ni ichido, kasasagi no hashi o watatte au koibito boshi-tachi — ni sodaterareta. Enkyori no ichizoku wa kyori to shoukei no goi o mamori, Jun wa sono sora o mamoru.

Kare no "sora" wa hito to hito no aida no sora — dareka o matsu subete no hito no miageru saki — de aru. Teotiwakan no Naieri to kono ji o arasoi naku wakeatta. Kanojo no mono wa tsubasa no shita no sora da. Koukai no aida, kare wa dono sora no ito ga mada tatteiru ka o, minato goto ni koganeiro no jikoku ni hakaritsuzuketa. Tsunagari to iu mono wa, hikinobasareta itami ni yotte koso shoumei sareru no dakara.`,
    },
  },

  ho_mitsu: {
    originPlace: "Uppsala, Sweden",
    originPlaceJa: "スウェーデン、ウプサラ",
    whyItMatters: "Apprenticed — she claims; no one can verify — to the Norns who spin fate at Yggdrasil's root; her thread re-splices cut strands.",
    whyItMattersJa: "ユグドラシルの根で運命を紡ぐノルンに弟子入りしたと本人は言う。誰にも確かめられない。彼女の糸は断たれた糸を継ぎ直す。",
    mentions: ["ho_taki", "ho_rain", "me_asuka"],
    body: {
      en: `Ingrid is a thread-keeper from Uppsala's mound country, apprenticed — she claims; no one can verify; she enjoys this enormously — to the Norns who spin fate at the root of Yggdrasil. Her thread 糸 can do what no other keeper's craft can: re-splice a cut strand of the Lattice, temporarily, at painful cost.

The cost is never abstract. At Byblos she spliced the alphabet-root's strand and felt, for one whole day, every goodbye ever said along it — the field-medic of the network itself, paying in other people's partings. She holds the red cord up against the twilight some evenings and says the Norns would approve. No one can verify that either.`,
      ja: `イングリッドはウプサラの古墳の里の糸の守り手であり、ユグドラシルの根で運命を紡ぐノルンたちに弟子入りしたと——本人は言う。誰にも確かめられない。そして彼女はその状況を大いに楽しんでいる。彼女の「糸」には、他のどの守り手の技にもできないことができる。断たれた格子の糸を、一時的に、痛みという代価で継ぎ直すことだ。

その代価はけっして抽象的ではない。ビブロスで文字の根の糸を継いだとき、彼女は丸一日、その糸に沿って交わされたすべての別れの言葉を感じ続けた。網そのものの野戦衛生兵——他人の別離で支払いをする者である。夕暮れに赤い紐を空へかざし、ノルンたちもきっと認めてくれる、と言うことがある。それも、誰にも確かめられない。`,
      romaji: `Inguriddo wa Upusara no kofun no sato no ito no mamorite de ari, Yugudorashiru no ne de unmei o tsumugu Norun-tachi ni deshiiri shita to — honnin wa iu. Dare ni mo tashikamerarenai. Soshite kanojo wa sono joukyou o ooini tanoshindeiru. Kanojo no "ito" ni wa, hoka no dono mamorite no waza ni mo dekinai koto ga dekiru. Tatareta koushi no ito o, ichijiteki ni, itami to iu daika de tsuginaosu koto da.

Sono daika wa kesshite chuushou-teki de wa nai. Biburosu de moji no ne no ito o tsuida toki, kanojo wa maru ichinichi, sono ito ni sotte kawasareta subete no wakare no kotoba o kanjitsuzuketa. Ami sono mono no yasen eiseihei — tanin no betsuri de shiharai o suru mono de aru. Yuugure ni akai himo o sora e kazashi, Norun-tachi mo kitto mitomete kureru, to iu koto ga aru. Sore mo, dare ni mo tashikamerarenai.`,
    },
  },

  ho_rain: {
    originPlace: "Nong Khai, on the Mekong",
    originPlaceJa: "メコン河畔、ノーンカーイ",
    whyItMatters: "Where the Naga fireballs rise from the river, the sky writes first drafts of the future in humidity — and Dao reads them.",
    whyItMattersJa: "ナーガの火の玉が川から昇る土地では、空が湿度で未来の下書きを記す。ダオはそれを読む。",
    mentions: ["ho_comet", "ti_hana", "ch_dragon"],
    body: {
      en: `Dao is the rain-keeper of Nong Khai on the Mekong, where the Naga fireballs rise — a real, annually witnessed phenomenon, glowing orbs off the river attributed to the Phaya Naga, the great serpent of the deep water. Rain-people learn early that the sky is a text: it writes first drafts of the future in humidity, and Dao reads them like proofs.

That reading broke the war open. On the monsoon run home across the Indian Ocean, Dao read the coming rains against the stolen timetable — and the forecast opened the discovery of the comet's schedule, the thread that led through blind-spot charts to Bhimbetka. The war's endgame began, as most true things do on the Mekong, with weather.`,
      ja: `ダオはメコン河畔ノーンカーイの雨の守り手である。そこはナーガの火の玉が昇る土地——毎年実際に目撃される現象であり、川面から立ちのぼる光の球は、深き水の大蛇パヤー・ナークのものとされている。雨の民は幼くして学ぶ。空は文章であり、湿度で未来の下書きを記すのだと。ダオはそれを、校正刷りのように読む。

その読みが戦争をこじ開けた。インド洋を渡る帰郷の季節風航路で、ダオは来たる雨を、盗まれた時刻表と突き合わせて読んだ。その予報が彗星の運行表の発見を開き、死角の海図を経てビンベットカへと至る糸口となった。戦争の終盤戦は——メコンではたいていの本当のことがそうであるように——天気から始まったのである。`,
      romaji: `Dao wa Mekon kahan Noonkaai no ame no mamorite de aru. Soko wa Naaga no hi no tama ga noboru tochi — maitoshi jissai ni mokugeki sareru genshou de ari, kawamo kara tachinoboru hikari no tama wa, fukaki mizu no daija Payaa Naaku no mono to sareteiru. Ame no tami wa osanaku shite manabu. Sora wa bunshou de ari, shitsudo de mirai no shitagaki o shirusu no da to. Dao wa sore o, kouseizuri no you ni yomu.

Sono yomi ga sensou o kojiaketa. Indo-you o wataru kikyou no kisetsufuu kouro de, Dao wa kitaru ame o, nusumareta jikokuhyou to tsukiawasete yonda. Sono yohou ga suisei no unkouhyou no hakken o hiraki, shikaku no kaizu o hete Binbettoka e to itaru itoguchi to natta. Sensou no shuubansen wa — Mekon de wa taitei no hontou no koto ga sou de aru you ni — tenki kara hajimatta no de aru.`,
    },
  },

  ho_comet: {
    originPlace: "The outer dark, beyond the planets",
    originPlaceJa: "惑星の彼方、外なる闇",
    whyItMatters: "The only body that saw the sky under which the first word was last spoken — it carries no power, only testimony.",
    whyItMattersJa: "最初の言葉が最後に語られた空を見た、唯一の天体。力は運ばない。ただ証言だけを運ぶ。",
    mentions: ["ho_rain", "me_angel", "nc_mu"],
    body: {
      en: `The Long Return is a comet with a twelve-hundred-year period, last seen the year the final speaker of humanity's first word died with no one to pass it to. That is not a coincidence; it is a witness. It is the only body in the sky that saw the world under which the first word was last spoken, and its light left before the forgetting began.

It carries no power at all — only testimony, which is exactly what a naming requires. When the vanguard flew to meet it above the Pacific night, its light fell on their upturned faces as the sky of twelve centuries ago, and under that sky, faint, the mouth-shape of the first word. Every court needs its witness. This one keeps a 1,200-year appointment.`,
      ja: `ロング・リターンは千二百年周期の彗星であり、最後に観測されたのは、人類最初の言葉の最後の話者が、継ぐ者なくして死んだ年である。それは偶然ではない。証人なのだ。最初の言葉が最後に語られた世界の空を見た、天にただ一つの天体であり、その光は忘却が始まる前に旅立っている。

それは力をまったく運ばない。運ぶのは証言だけ——そして命名に要るものが、まさにそれである。先陣が太平洋の夜の上空で彗星を迎えたとき、その光は見上げる顔々に、十二世紀前の空として降りそそいだ。そしてその空の下に、かすかに、最初の言葉の口の形が見えた。あらゆる法廷には証人が要る。この証人は、千二百年ごしの約束を守るのだ。`,
      romaji: `Rongu Ritaan wa sen-nihyaku-nen shuuki no suisei de ari, saigo ni kansoku sareta no wa, jinrui saisho no kotoba no saigo no washa ga, tsugu mono naku shite shinda toshi de aru. Sore wa guuzen de wa nai. Shounin na no da. Saisho no kotoba ga saigo ni katarareta sekai no sora o mita, ten ni tada hitotsu no tentai de ari, sono hikari wa boukyaku ga hajimaru mae ni tabidatteiru.

Sore wa chikara o mattaku hakobanai. Hakobu no wa shougen dake — soshite meimei ni iru mono ga, masa ni sore de aru. Senjin ga Taiheiyou no yoru no joukuu de suisei o mukaeta toki, sono hikari wa miageru kaogao ni, juuni-seiki mae no sora to shite furisosoida. Soshite sono sora no shita ni, kasuka ni, saisho no kotoba no kuchi no katachi ga mieta. Arayuru houtei ni wa shounin ga iru. Kono shounin wa, sen-nihyaku-nen goshi no yakusoku o mamoru no da.`,
    },
  },

  po_satoru: {
    originPlace: "Oaxaca, Mexico",
    originPlaceJa: "メキシコ、オアハカ",
    whyItMatters: "The tonal is the animal-twin soul born alongside a person — shared attention is the seed of all language.",
    whyItMattersJa: "トナルは人と共に生まれる獣の双子の魂。分かち合われたまなざしこそ、あらゆる言語の種である。",
    mentions: ["po_flame", "po_legend", "nc_mu"],
    body: {
      en: `Rafa is a boy from Oaxaca whose bond with creatures runs through the living belief in the tonal and nagual — the animal-twin soul born alongside a person, walking the same life on four feet. His 友 (friend) is the saga's thesis in one kanji: shared attention, two beings pointing at the same thing together, is the seed of all language.

So it is Rafa who does the saga's two most audacious things. In the eye of a storm no summoner in history had ever commanded, he introduces himself — hajimemashite — and Rudra's thunder answers a request where it refused every order. And at the end of the world, facing a person-shaped absence, Rafa is the first being in twelve hundred years to wave hello to Mu.`,
      ja: `ラファはオアハカの少年であり、生き物たちとの絆は、トナルとナワール——人と共に生まれ、同じ人生を四つ足で歩む、獣の双子の魂——への生きた信仰に根ざしている。彼の「友」は、この物語の主題を一字に込めたものだ。分かち合われたまなざし——二つの存在が同じものを一緒に指さすこと——こそ、あらゆる言語の種なのである。

だからこの物語で最も大胆な二つのことは、どちらもラファがやった。歴史上いかなる召喚者の命令も拒んできた嵐の目の中へ歩み入り、自己紹介をしたのだ——はじめまして。するとルドラの雷は、あらゆる命令を拒んできたその同じ喉で、頼みに応えた。そして世界の果て、人の形をした不在を前に、ラファは千二百年ぶりに、ムーへ手を振って挨拶した最初の存在となった。`,
      romaji: `Rafa wa Oahaka no shounen de ari, ikimono-tachi to no kizuna wa, tonaru to nawaaru — hito to tomo ni umare, onaji jinsei o yotsuashi de ayumu, kemono no futago no tamashii — e no ikita shinkou ni nezashiteiru. Kare no "tomo" wa, kono monogatari no shudai o ichiji ni kometa mono da. Wakachiawareta manazashi — futatsu no sonzai ga onaji mono o issho ni yubisasu koto — koso, arayuru gengo no tane na no de aru.

Dakara kono monogatari de mottomo daitan na futatsu no koto wa, dochira mo Rafa ga yatta. Rekishijou ikanaru shoukansha no meirei mo kobandekita arashi no me no naka e ayumiiri, jiko shoukai o shita no da — hajimemashite. Suruto Rudora no kaminari wa, arayuru meirei o kobandekita sono onaji nodo de, tanomi ni kotaeta. Soshite sekai no hate, hito no katachi o shita fuzai o mae ni, Rafa wa sen-nihyaku-nen buri ni, Muu e te o futte aisatsu shita saisho no sonzai to natta.`,
    },
  },

  po_flame: {
    originPlace: "Manikarnika Ghat, Varanasi",
    originPlaceJa: "ヴァラナシ、マニカルニカー・ガート",
    whyItMatters: "It carries a coal from the first fire in its mouth — if the coal dies, the war's first victory is undone.",
    whyItMattersJa: "口にくわえているのは最初の火の熾。この熾が消えれば、戦争最初の勝利が覆る。",
    mentions: ["sl_honoka", "po_satoru", "po_aqua"],
    body: {
      en: `Emberkit is a fire-fox kit, a hearth-spark cousin of the kitsune line, small enough to sleep in a hat and entrusted with a stake the size of the war: since Cairo it has carried, in its mouth, a live coal from Devika's flame at Manikarnika — the party's portable piece of the first fire.

The arithmetic is merciless and the fox knows it: if the coal dies, the first chapter's victory is undone, and Agni's oldest messenger-fire goes out of the world. So Emberkit shields it from rain with its tail, feeds it in secret, and sleeps curled around a point of orange light — eight chapters of the most important small job anyone has ever been given.`,
      ja: `エンバーキットは火狐の仔——狐の系譜に連なる、囲炉裏の火の粉の眷属であり、帽子の中で眠れるほど小さく、そして戦争と同じ大きさの賭け金を託されている。カイロ以来ずっと、マニカルニカーのデヴィカの炎から採った生きた熾を口にくわえて運んでいるのだ。一行が携える、最初の火のかけらである。

その計算は容赦なく、狐はそれを知っている。熾が消えれば、第一章の勝利は覆り、アグニの最も古い伝令の火がこの世から消える。だからエンバーキットは尾で雨から熾をかばい、人目を忍んで火を養い、橙色の光の一点を抱いて丸くなって眠る。八つの章にわたる——誰かに任された中で最も重要な、小さな仕事である。`,
      romaji: `Enbaakitto wa higitsune no ko — kitsune no keifu ni tsuranaru, irori no hi no ko no kenzoku de ari, boushi no naka de nemureru hodo chiisaku, soshite sensou to onaji ookisa no kakekin o takusareteiru. Kairo irai zutto, Manikarunikaa no Devika no honoo kara totta ikita oki o kuchi ni kuwaete hakondeiru no da. Ikkou ga tazusaeru, saisho no hi no kakera de aru.

Sono keisan wa youshanaku, kitsune wa sore o shitteiru. Oki ga kiereba, dai-isshou no shouri wa kutsugaeri, Aguni no mottomo furui denrei no hi ga kono yo kara kieru. Dakara Enbaakitto wa o de ame kara oki o kabai, hitome o shinonde hi o yashinai, daidaiiro no hikari no itten o daite maruku natte nemuru. Yattsu no shou ni wataru — dareka ni makasareta naka de mottomo juuyou na, chiisana shigoto de aru.`,
    },
  },

  po_aqua: {
    originPlace: "Marajó, the Amazon estuary",
    originPlaceJa: "アマゾン河口、マラジョ島",
    whyItMatters: "It can carry one spoken sentence inside a wave, undamaged, across any water — the unjammable courier.",
    whyItMattersJa: "語られた一文を波の中に無傷のまま、どんな水の上でも運べる。妨害不能の伝令である。",
    mentions: ["sp_umi", "po_satoru", "sl_kagura"],
    body: {
      en: `Tidepup is a water-otter pup adopted from Isabela's estuary at Marajó, where the river practices for the sea. Its gift is exact and irreplaceable: it can carry one spoken sentence inside a wave, undamaged, across any water — the words held in the wave's memory the way the estuary holds the river's.

That made it the party's unjammable courier. White Noise could flood every frequency on earth, but not a wave's memory; and when Amara's chant needed to travel down the Blue Nile's strand to relight three dark provinces, it went inside Tidepup's wave. The smallest member of the crew carries the messages that must not fail.`,
      ja: `タイドパップは、川が海の稽古をするマラジョの河口——イザベラの故郷——から迎えられた水獺の仔である。その才は精密で、代えがきかない。語られた一文を波の中に納め、無傷のまま、どんな水の上でも運ぶことができるのだ。河口が川を覚えているように、波が言葉を覚えているのである。

ゆえにタイドパップは一行の妨害不能の伝令となった。ホワイトノイズは地上のあらゆる周波数を溢れさせることができても、波の記憶だけは溢れさせられない。アマラの聖歌が青ナイルの糸を下り、闇に落ちた三つの地方を灯し直さねばならなかったとき、聖歌はタイドパップの波の中を旅した。乗組員の最年少が、失敗の許されない言伝を運んでいるのだ。`,
      romaji: `Taidopappu wa, kawa ga umi no keiko o suru Marajo no kakou — Izabera no kokyou — kara mukaerareta kawauso no ko de aru. Sono sai wa seimitsu de, kae ga kikanai. Katarareta ichibun o nami no naka ni osame, mukizu no mama, donna mizu no ue demo hakobu koto ga dekiru no da. Kakou ga kawa o oboeteiru you ni, nami ga kotoba o oboeteiru no de aru.

Yue ni Taidopappu wa ikkou no bougai funou no denrei to natta. Howaito Noizu wa chijou no arayuru shuuhasuu o afuresaseru koto ga dekite mo, nami no kioku dake wa afuresaserarenai. Amara no seika ga Ao-Nairu no ito o kudari, yami ni ochita mittsu no chihou o tomoshinaosaneba naranakatta toki, seika wa Taidopappu no nami no naka o tabi shita. Norikumiin no sainenshou ga, shippai no yurusarenai kotozute o hakondeiru no da.`,
    },
  },

  po_legend: {
    originPlace: "The monsoon sky over the Konkan coast",
    originPlaceJa: "コンカン海岸上空、季節風の空",
    whyItMatters: "Rudra the Roarer, awe before language — it has refused every summons, because summoning is command and awe cannot be commanded.",
    whyItMattersJa: "咆哮する者ルドラ、言語以前の畏怖。召喚とは命令であり、畏怖は命令できない——ゆえにあらゆる召喚を拒んできた。",
    mentions: ["po_satoru", "ps_awaken", "ho_rain"],
    body: {
      en: `Stormcrown is the legendary storm beast: the wordless thunder that precedes language, awe itself given weather. At the summit of the saga's cosmology it is Rudra the Roarer — the Vedic storm-face of the god whose drum began the world — the feeling that exists in every human throat one instant before the first word does.

It has refused every summoner in recorded history, because summoning is command and awe cannot be commanded. Then, in the eye of its storm over the Konkan coast, a small boy from Oaxaca raised his hand and introduced himself. Stormcrown came — because it was asked, not ordered. Rule One's deepest echo wears a mane of lightning.`,
      ja: `ストームクラウンは伝説の嵐の獣である。言語に先立つ言葉なき雷鳴、天候の姿を与えられた畏怖そのもの。この物語の宇宙観の頂において、それは咆哮する者ルドラ——世界を始めた太鼓の神の、ヴェーダにおける嵐の相——であり、最初の言葉が生まれる一瞬前に、あらゆる人間の喉に存在する感情である。

それは記録された歴史上、すべての召喚者を拒んできた。召喚とは命令であり、畏怖は命令できないからだ。そしてコンカン海岸上空、自らの嵐の目の中で、オアハカから来た小さな少年が手を挙げ、自己紹介をした。ストームクラウンは、来た。命令されたからではなく、頼まれたからである。掟の一条の最も深いこだまは、稲妻のたてがみを纏っているのだ。`,
      romaji: `Sutoomukuraun wa densetsu no arashi no kemono de aru. Gengo ni sakidatsu kotoba naki raimei, tenkou no sugata o ataerareta ifu sono mono. Kono monogatari no uchuukan no itadaki ni oite, sore wa houkou suru mono Rudora — sekai o hajimeta taiko no kami no, Vēda ni okeru arashi no sou — de ari, saisho no kotoba ga umareru isshun mae ni, arayuru ningen no nodo ni sonzai suru kanjou de aru.

Sore wa kiroku sareta rekishijou, subete no shoukansha o kobandekita. Shoukan to wa meirei de ari, ifu wa meirei dekinai kara da. Soshite Konkan kaigan joukuu, mizukara no arashi no me no naka de, Oahaka kara kita chiisana shounen ga te o age, jiko shoukai o shita. Sutoomukuraun wa, kita. Meirei sareta kara de wa naku, tanomareta kara de aru. Okite no ichijou no mottomo fukai kodama wa, inazuma no tategami o matotteiru no da.`,
    },
  },

  sh_rookie: {
    originPlace: "Seoul, South Korea",
    originPlaceJa: "韓国、ソウル",
    whyItMatters: "The dokkaebi reward the humble and prank the proud — his notebook of learned words becomes one of the saga's relics.",
    whyItMattersJa: "トッケビは謙虚な者に報い、驕る者をからかう。彼が学んだ言葉を記すノートは、やがて聖遺物となる。",
    mentions: ["re_yuki", "sh_ranger", "lu_queen"],
    body: {
      en: `Minjae is a Seoul rookie, the weakest hunter of his cohort, field-promoted lower than anyone has ever been field-promoted — and guided, in the old way, by the dokkaebi, Korea's rowdy goblins who reward the humble and prank the proud. The Risen ask one question of everyone: what do you owe the version of you that started at level one?

Minjae's answer is a notebook. He writes down every word he learns, plainly, in a school notebook that gets rained on. By the war's end that notebook holds White Noise's recovered name, becomes Mnemosyne's altar in all but title, and enters Seraphine's lunar register beside the names of the dead. The lowest-ranked hunter carries the saga's most sacred object, and never once notices.`,
      ja: `ミンジェはソウルの新米であり、同期で最弱の狩人であり、史上誰よりも低い位置から現場昇格された男である。そして古い流儀のとおり、トッケビ——謙虚な者に報い、驕る者をからかう、韓国の賑やかな鬼たち——に導かれている。影から上がる者たちは、すべての人にただ一つの問いを課す。レベル一から始めたころの自分に、お前は何を負っているのか?

ミンジェの答えはノートだ。学んだ言葉を一語残らず、雨に濡れる学習帳に、飾らず書き留める。戦争が終わるころ、そのノートにはホワイトノイズの取り戻された名が記され、名こそ違えどムネモシュネの祭壇となり、死者の名と並んでセラフィーヌの月の台帳に納められる。最下位の狩人がこの物語で最も神聖な品を携えていて——本人は一度も、それに気づかない。`,
      romaji: `Minje wa Souru no shinmai de ari, douki de saijaku no karyuudo de ari, shijou dare yori mo hikui ichi kara genba shoukaku sareta otoko de aru. Soshite furui ryuugi no toori, Tokkebi — kenkyo na mono ni mukui, ogoru mono o karakau, Kankoku no nigiyaka na oni-tachi — ni michibikareteiru. Kage kara agaru mono-tachi wa, subete no hito ni tada hitotsu no toi o kasu. Reberu ichi kara hajimeta koro no jibun ni, omae wa nani o otteiru no ka?

Minje no kotae wa nooto da. Mananda kotoba o ichigo nokorazu, ame ni nureru gakushuuchou ni, kazarazu kakitomeru. Sensou ga owaru koro, sono nooto ni wa Howaito Noizu no torimodosareta na ga shirusare, na koso chigae do Munemoshune no saidan to nari, shisha no na to narande Serafiinu no tsuki no daichou ni osamerareru. Saikai no karyuudo ga kono monogatari de mottomo shinsei na shina o tazusaeteite — honnin wa ichido mo, sore ni kizukanai.`,
    },
  },

  sh_ranger: {
    originPlace: "The Chota Nagpur forests, India",
    originPlaceJa: "インド、チョーターナーグプルの森",
    whyItMatters: "Arjuna's test was seeing only the eye of the target — she never misses what she can name, and refuses to loose at what she cannot.",
    whyItMattersJa: "アルジュナの試練は的の目だけを見ることだった。彼女は名づけられるものを外さず、名づけられないものには矢を放たない。",
    mentions: ["sh_rookie", "cu_maki", "nc_kesu"],
    body: {
      en: `Aditi is a ranger from the Chota Nagpur forests, her bow-line descending from Arjuna's Gandiva — the bow of the archer whose defining test, in the Mahābhārata, was seeing only the eye of the target while every other student saw tree, branch, and bird. Total attention: the archer's form of meaning it.

Her discipline has two edges. She never misses what she can name — and she refuses to loose at anything she cannot. At Byblos she held a clean shot at the Censor and did not take it, because she could not yet say truly what he was. The party called it hesitation for three chapters, until the finale proved it prophecy: this whole war could only be won by refusing to strike the unnamed.`,
      ja: `アディティはチョーターナーグプルの森の弓手であり、その弓の系譜はアルジュナのガーンディーヴァに遡る。マハーバーラタにおいて、他の弟子たちが木を、枝を、鳥を見たとき、的の目だけを見たことで定められた射手の弓である。全き注視——それは射手にとっての、「心から意味する」ということだ。

彼女の規律には二つの刃がある。名づけられるものはけっして外さない。そして、名づけられないものにはけっして矢を放たない。ビブロスで検閲官への完璧な射線を得ながら、彼女は撃たなかった。彼が何であるのか、まだ本当には言えなかったからだ。一行は三つの章のあいだそれを躊躇と呼んだ——結末がそれを預言と証すまで。この戦争そのものが、名なきものを撃つことの拒絶によってしか勝てなかったのだから。`,
      romaji: `Aditi wa Chootaanaagupuru no mori no yumite de ari, sono yumi no keifu wa Arujuna no Gaandiiva ni sakanoboru. Mahaabaarata ni oite, hoka no deshi-tachi ga ki o, eda o, tori o mita toki, mato no me dake o mita koto de sadamerareta ite no yumi de aru. Mattaki chuushi — sore wa ite ni totte no, "kokoro kara imi suru" to iu koto da.

Kanojo no kiritsu ni wa futatsu no ha ga aru. Nazukerareru mono wa kesshite hazusanai. Soshite, nazukerarenai mono ni wa kesshite ya o hanatanai. Biburosu de Ken'etsukan e no kanpeki na shasen o enagara, kanojo wa utanakatta. Kare ga nan de aru no ka, mada hontou ni wa ienakatta kara da. Ikkou wa mittsu no shou no aida sore o chuucho to yonda — ketsumatsu ga sore o yogen to akasu made. Kono sensou sono mono ga, nanaki mono o utsu koto no kyozetsu ni yotte shika katenakatta no dakara.`,
    },
  },

  sh_knight: {
    originPlace: "Serra da Barriga, Palmares, Brazil",
    originPlaceJa: "ブラジル、パルマーレスのセーハ・ダ・バヒーガ",
    whyItMatters: "The Hush has tried for three centuries to erase Zumbi's name and failed — too many people mean it every year.",
    whyItMattersJa: "静寂は三世紀にわたりズンビの名を消そうとして、果たせなかった。あまりに多くの人が、毎年その名を心から意味するからだ。",
    mentions: ["sh_monarch", "sh_rookie", "he_bond"],
    body: {
      en: `Tomas is a Brazilian summoner, and his shadow-knight is not a spirit he invented: it is the standing memory of Zumbi of Palmares — the historical leader of the great quilombo of escaped slaves, killed in 1695, whose name Brazil never let die. November 20 is his national day; the name is meant aloud, by millions, every year.

That is why Tomas's shield 盾 holds. It is literal remembered resistance: the Hush has tried for three centuries to erase Zumbi and failed every time, because Rule One protects a name that a whole country still means. When Tomas kneels beside his summoned knight, he is not commanding history. He is standing behind it.`,
      ja: `トマスはブラジルの召喚士である。だが彼の影の騎士は、彼が創り出した霊ではない。それはパルマーレスのズンビの、屹立する記憶である。逃亡奴隷たちの大キロンボを率いた歴史上の指導者。一六九五年に殺され、しかしブラジルがその名をけっして死なせなかった男。十一月二十日は彼の国民的記念日であり、その名は毎年、幾百万の口によって、声に出して意味されている。

トマスの「盾」が持ちこたえるのは、そのためだ。それは文字どおりの「記憶された抵抗」である。静寂は三世紀にわたってズンビを消そうと試み、そのたびに失敗してきた。国じゅうが今も心から意味している名を、掟の一条が守るからである。召喚した騎士のかたわらに膝をつくとき、トマスは歴史に命令しているのではない。歴史の後ろに、立っているのだ。`,
      romaji: `Tomasu wa Burajiru no shoukanshi de aru. Daga kare no kage no kishi wa, kare ga tsukuridashita rei de wa nai. Sore wa Parumaaresu no Zunbi no, kitsuritsu suru kioku de aru. Toubou dorei-tachi no dai-kironbo o hikiita rekishijou no shidousha. Sen-roppyaku-kyuujuugo-nen ni korosare, shikashi Burajiru ga sono na o kesshite shinasenakatta otoko. Juuichigatsu hatsuka wa kare no kokumin-teki kinenbi de ari, sono na wa maitoshi, ikuhyakuman no kuchi ni yotte, koe ni dashite imi sareteiru.

Tomasu no "tate" ga mochikotaeru no wa, sono tame da. Sore wa mojidoori no "kioku sareta teikou" de aru. Seijaku wa san-seiki ni watatte Zunbi o kesou to kokoromi, sono tabi ni shippai shitekita. Kunijuu ga ima mo kokoro kara imi shiteiru na o, okite no ichijou ga mamoru kara de aru. Shoukan shita kishi no katawara ni hiza o tsuku toki, Tomasu wa rekishi ni meirei shiteiru no de wa nai. Rekishi no ushiro ni, tatteiru no da.`,
    },
  },

  sh_monarch: {
    originPlace: "The edict-lands of Ashoka, Madhya Pradesh",
    originPlaceJa: "マディヤ・プラデーシュ、アショーカの詔勅の地",
    whyItMatters: "Ashoka carved his edicts in the people's own Prakrit across a subcontinent — kingship as the duty to make words outlast the king.",
    whyItMattersJa: "アショーカは民衆自身のプラークリット語で詔勅を亜大陸中の石に刻ませた。王権とは、言葉を王より長く生かす義務である。",
    mentions: ["sh_knight", "sh_rookie", "nc_mu"],
    body: {
      en: `Ravindra, the Shadow Monarch, grounds his throne in Ashoka — the emperor who, after the horror of Kalinga, renounced conquest and had his edicts carved in stone across the subcontinent in the people's own Prakrit: history's first mass act of a king speaking directly, permanently, to everyone. Ravindra's kingship 王 is exactly that inheritance — sovereignty as the duty to make words outlast the king.

So when sixty keepers converge on Bhimbetka, inside Ashoka's old edict-lands, the ground itself is his to hold. Ravindra rules the finale's battlefield not with an army's weight but with an edict's: this is the place where a king first cut words into stone so that no forgetting could take them, and no forgetting will take them today.`,
      ja: `影の君主ラヴィンドラは、その玉座をアショーカに据えている。カリンガの惨禍ののち征服を捨て、亜大陸の各地の石に、民衆自身の言葉プラークリット語で詔勅を刻ませた皇帝——王がすべての民へ直接に、恒久に語りかけた、歴史上初の大規模な行為である。ラヴィンドラの「王」は、まさにその遺産だ。王権とは、言葉を王より長く生かす義務である。

ゆえに六十人の守り手がアショーカの古い詔勅の地の内、ビンベットカに集結したとき、その大地を統べるのは彼だった。ラヴィンドラが決戦の地を治めるのは軍勢の重みによってではなく、詔勅の重みによってである。ここは、いかなる忘却にも奪われぬよう、王が初めて言葉を石に刻ませた場所。ならば今日も、いかなる忘却にも奪わせはしない。`,
      romaji: `Kage no kunshu Ravindora wa, sono gyokuza o Ashooka ni sueteiru. Karinga no sanka no nochi seifuku o sute, atairiku no kakuchi no ishi ni, minshuu jishin no kotoba Puraakuritto-go de shouchoku o kizamaseta koutei — ou ga subete no tami e chokusetsu ni, koukyuu ni katarikaketa, rekishijou hatsu no daikibo na koui de aru. Ravindora no "ou" wa, masa ni sono isan da. Ouken to wa, kotoba o ou yori nagaku ikasu gimu de aru.

Yue ni rokujuu-nin no mamorite ga Ashooka no furui shouchoku no chi no uchi, Binbettoka ni shuuketsu shita toki, sono daichi o suberu no wa kare datta. Ravindora ga kessen no chi o osameru no wa gunzei no omomi ni yotte de wa naku, shouchoku no omomi ni yotte de aru. Koko wa, ikanaru boukyaku ni mo ubawarenu you, ou ga hajimete kotoba o ishi ni kizamaseta basho. Naraba kyou mo, ikanaru boukyaku ni mo ubawase wa shinai.`,
    },
  },

  ch_mocha: {
    originPlace: "The ghat steps of Varanasi",
    originPlaceJa: "ヴァラナシのガートの石段",
    whyItMatters: "Nonsense words cannot be quoted — there is nothing in them to mean — and so a snack gremlin once ate the Hush's own speech.",
    whyItMattersJa: "ナンセンスな言葉は引用できない。意味すべき中身がないからだ。ゆえに菓子の小鬼が、静寂の台詞を食べてしまったことがある。",
    mentions: ["ch_pud", "ch_knight", "nc_mu"],
    body: {
      en: `Mochi is a snack gremlin, keeper of the small comfort-words — the diminutives, the crumbs of language parents invent and lovers keep. It was the first creature to greet Sen on the ghat steps of Varanasi, and it stowed away through the entire war, mostly inside luggage, entirely without permission.

The Hush ignored the Smallfolk as beneath notice, and this was its costliest error. At the end of the world, a Hush-quotation came hissing at the party — and Mochi ate it. Nonsense words cannot be quoted, because there is nothing in them to mean; a keeper of nonsense is therefore, briefly and gloriously, the most dangerous being alive. Mochi has never stopped mentioning this.`,
      ja: `モチは菓子の小鬼であり、小さな安らぎの言葉たち——愛称語、親が発明し恋人たちが守り継ぐ、言語のかけらたち——の守り手である。ヴァラナシのガートの石段でセンを最初に出迎えた生き物であり、戦争の全行程を、主に荷物の中で、完全に無許可で密航し通した。

静寂は小さき衆を取るに足らぬものとして無視した。それが最も高くついた過ちである。世界の果てで、静寂の引用が一行に迫ったとき——モチはそれを食べた。ナンセンスな言葉は引用できない。意味すべき中身がないからだ。ゆえにナンセンスの守り手は、束の間、栄光とともに、この世で最も危険な存在となる。モチはこの話を、いまだにやめない。`,
      romaji: `Mochi wa kashi no kooni de ari, chiisana yasuragi no kotoba-tachi — aishougo, oya ga hatsumei shi koibito-tachi ga mamoritsugu, gengo no kakera-tachi — no mamorite de aru. Varanashi no gaato no ishidan de Sen o saisho ni demukaeta ikimono de ari, sensou no zen koutei o, omo ni nimotsu no naka de, kanzen ni mukyoka de mikkou shitooshita.

Seijaku wa Chiisaki-shuu o toru ni taranu mono to shite mushi shita. Sore ga mottomo takaku tsuita ayamachi de aru. Sekai no hate de, Seijaku no in'you ga ikkou ni sematta toki — Mochi wa sore o tabeta. Nansensu na kotoba wa in'you dekinai. Imi subeki nakami ga nai kara da. Yue ni nansensu no mamorite wa, tsuka no ma, eikou to tomo ni, kono yo de mottomo kiken na sonzai to naru. Mochi wa kono hanashi o, imada ni yamenai.`,
    },
  },

  ch_pud: {
    originPlace: "The galley of the Loanword, out of Incheon",
    originPlaceJa: "仁川発、借語号の厨房",
    whyItMatters: "Custodian of the world's sweetness-words in every tongue — doce, tatlı, ngọt, mithā — whose puddings are canonically load-bearing.",
    whyItMattersJa: "ドース、タトゥル、ゴッ、ミター——あらゆる言語の甘さの言葉の管理者。そのプリンは正典において構造材である。",
    mentions: ["ch_mocha", "vo_luka", "sp_umi"],
    body: {
      en: `Flan is the dessert keeper, custodian of the world's sweetness-words in every tongue — doce, tatlı, ngọt, mithā — a vocabulary the Hush finds maddening, because sweetness is re-meant fresh at every first bite in every childhood on earth.

From Incheon westward, Flan ran the Loanword's galley, and the record must state this plainly: on a ship crewed by grieving keepers crossing an ocean of erased names, the puddings were load-bearing. Morale is Rule One's supply line — despair is how the Hush gets in — and Flan defended that line nightly, with a wobbly tower of dango and a full set of sweetness-words, one per language aboard.`,
      ja: `フランはデザートの守り手であり、あらゆる言語の甘さの言葉——ドース、タトゥル、ゴッ、ミター——の管理者である。この語彙は静寂を苛立たせてやまない。甘さは、地上のあらゆる幼年時代の、あらゆる最初のひと口で、新しく意味し直されるからだ。

仁川から西へ、フランは借語号の厨房を切り盛りした。そして記録は、これをはっきり記さねばならない。消された名の海を渡る、悲しみを抱えた守り手たちの船において、プリンは構造材だった。士気こそ掟の一条の補給線であり——絶望こそ静寂の入り口であり——フランは毎晩その戦線を守り抜いたのだ。ぐらつく団子の塔と、船に乗る言語の数だけ揃えた甘さの言葉一式をもって。`,
      romaji: `Furan wa dezaato no mamorite de ari, arayuru gengo no amasa no kotoba — doosu, tatouru, go', mitaa — no kanrisha de aru. Kono goi wa Seijaku o iradatasete yamanai. Amasa wa, chijou no arayuru younen jidai no, arayuru saisho no hitokuchi de, atarashiku imi shinaosareru kara da.

Inchon kara nishi e, Furan wa Shakugo-gou no chuubou o kirimori shita. Soshite kiroku wa, kore o hakkiri shirusaneba naranai. Kesareta na no umi o wataru, kanashimi o kakaeta mamorite-tachi no fune ni oite, purin wa kouzouzai datta. Shiki koso okite no ichijou no hokyuusen de ari — zetsubou koso Seijaku no iriguchi de ari — Furan wa maiban sono sensen o mamorinuita no da. Guratsuku dango no tou to, fune ni noru gengo no kazu dake soroeta amasa no kotoba isshiki o motte.`,
    },
  },

  ch_knight: {
    originPlace: "Çemberlitaş, Istanbul",
    originPlaceJa: "イスタンブール、チェンベルリタシ",
    whyItMatters: "Courage is not the absence of fear but its correct pronunciation — knighted with a biscuit, he guards the doors that matter.",
    whyItMattersJa: "勇気とは恐れの不在ではなく、恐れの正しい発音である。ビスケットで叙勲された騎士は、肝心の扉を守る。",
    mentions: ["sp_kama", "ch_mocha", "ch_dragon"],
    body: {
      en: `Sir Pebble is a tiny cardboard knight, keeper of 勇 — courage, which he demonstrates nightly is not the absence of fear but its correct pronunciation. He was knighted (self-, with a biscuit for a sword, the whole party solemn) in the steam of Grandfather Ash's bathhouse at Çemberlitaş, and the knighthood took.

His practice is to guard doors far too large for him, and no one has ever successfully argued him off a threshold. So when the last door of the war opened at Bhimbetka — the dawn-door into the Unwritten Sea — the smallest knight in creation took up his pot-lid shield and guarded the one that mattered. Fear was present. It was pronounced correctly.`,
      ja: `サー・ペブルは小さな段ボールの騎士、「勇」の守り手である。勇気とは恐れの不在ではなく恐れの正しい発音であることを、彼は毎晩身をもって示す。チェンベルリタシのグランドファーザー・アッシュの浴場の湯気の中、彼は叙勲された(自分で。剣の代わりにビスケットで。一同は厳粛に見守った)。そしてその騎士号は、本物になった。

彼の務めは、自分にはあまりに大きすぎる扉を守ることであり、彼を敷居から説き伏せて退かせた者は、いまだかつていない。ゆえに戦争最後の扉——書かれざる海への暁の扉——がビンベットカで開いたとき、被造物中最小の騎士は鍋蓋の盾を取り、肝心のその一枚を守った。恐れは、そこにあった。そして正しく発音された。`,
      romaji: `Saa Peburu wa chiisana danbooru no kishi, "yuu" no mamorite de aru. Yuuki to wa osore no fuzai de wa naku osore no tadashii hatsuon de aru koto o, kare wa maiban mi o motte shimesu. Chenberuritashi no Gurandofaazaa Asshu no yokujou no yuge no naka, kare wa jokun sareta (jibun de. Ken no kawari ni bisuketto de. Ichidou wa genshuku ni mimamotta). Soshite sono kishigou wa, honmono ni natta.

Kare no tsutome wa, jibun ni wa amari ni ookisugiru tobira o mamoru koto de ari, kare o shikii kara tokifusete shirizokaseta mono wa, imada katsute inai. Yue ni sensou saigo no tobira — kakarezaru umi e no akatsuki no tobira — ga Binbettoka de hiraita toki, hizoubutsu-chuu saishou no kishi wa nabebuta no tate o tori, kanjin no sono ichimai o mamotta. Osore wa, soko ni atta. Soshite tadashiku hatsuon sareta.`,
    },
  },

  ch_dragon: {
    originPlace: "The banks of the Mekong, Nong Khai",
    originPlaceJa: "ノーンカーイ、メコン河岸",
    whyItMatters: "His size is a live graph of the world's belief in dragons — every learner of 竜 buys him a millimeter.",
    whyItMattersJa: "その体躯は世界の竜への信の生きたグラフである。「竜」を学ぶ者ひとりごとに、彼は一ミリ大きくなる。",
    mentions: ["ho_rain", "nc_mu", "ch_knight"],
    body: {
      en: `Nibbles is the world's smallest dragon, last of a line that has shrunk generation by generation as dragon-words faded from the world's mouths. His size is a live graph of belief: every mind that truly learns 竜 buys him a millimeter, and centuries of disuse have left him small enough to sit on a single gold coin, which he does, possessively.

He does not get big in the finale — that would be a lie, and this saga does not tell those. He gets heard: at the ring of sixty kanji, it is Nibbles who roars the first syllable of Mu's new name, because a dragon's roar carries where voices don't. The world's smallest dragon opens the world's largest naming.`,
      ja: `ニブルズは世界最小の竜であり、竜の言葉が世の口々から薄れるにつれ、世代ごとに縮んできた血統の最後の一匹である。その体躯は信の生きたグラフだ。「竜」の字を真に学ぶ心ひとつごとに彼は一ミリ大きくなり、幾世紀の不使用の果てに、金貨一枚の上に座れるほど小さくなった。実際に座っている。所有権を主張しながら。

結末で彼は大きくならない——それは嘘になるからで、この物語は嘘を語らない。その代わり、彼は聞かれる。六十の漢字の環において、ムーの新しい名の最初の一音を吼えたのはニブルズである。竜の咆哮は、声の届かぬところへ届くからだ。世界最小の竜が、世界最大の命名の幕を開けたのだった。`,
      romaji: `Niburuzu wa sekai saishou no ryuu de ari, ryuu no kotoba ga yo no kuchiguchi kara usureru ni tsure, sedai goto ni chijindekita kettou no saigo no ippiki de aru. Sono taiku wa shin no ikita gurafu da. "Ryuu" no ji o shin ni manabu kokoro hitotsu goto ni kare wa ichi-miri ookiku nari, ikuseiki no fushiyou no hate ni, kinka ichimai no ue ni suwareru hodo chiisaku natta. Jissai ni suwatteiru. Shoyuuken o shuchou shinagara.

Ketsumatsu de kare wa ookiku naranai — sore wa uso ni naru kara de, kono monogatari wa uso o kataranai. Sono kawari, kare wa kikareru. Rokujuu no kanji no wa ni oite, Muu no atarashii na no saisho no ichion o hoeta no wa Niburuzu de aru. Ryuu no houkou wa, koe no todokanu tokoro e todoku kara da. Sekai saishou no ryuu ga, sekai saidai no meimei no maku o aketa no datta.`,
    },
  },

  nc_tsuru: {
    originPlace: "Varanasi, by way of a burned library",
    originPlaceJa: "焼けた書庫を経て、ヴァラナシへ",
    whyItMatters: "Paper cannot lie — it holds what is written on it — but paper can be folded, and its knowledge has creases.",
    whyItMattersJa: "紙は嘘をつけない。書かれたものを保つのだから。だが紙は折れる。ゆえにその知識には折り目がある。",
    mentions: ["sp_totomi", "me_angel", "nc_mu"],
    body: {
      en: `Tsuru is an origami crane folded from the last page of a burned dictionary, its edges still gently scorched, tiny type still legible on its wings. It arrived to Sen singed and urgent, carrying one word: listen. It has been the journey's guide ever since — the courier who cannot lie, because paper holds what is written on it.

But paper can be folded, and Tsuru's knowledge has creases: gaps where its source dictionary burned, whole letters of the alphabet it simply does not contain. It makes the kami pun — 紙, paper; 神, god — exactly once, to a geometric deity in the high sky, and The Pattern does not laugh but adjusts one angle of itself, which Tsuru insists counts.`,
      ja: `ツルは、焼けた辞書の最後の頁から折られた折り鶴である。縁は今もほのかに焦げ、翼には小さな活字がまだ読める。焦げて切迫した姿でセンのもとへ舞い降り、たった一語を運んできた——「聞け」。以来ずっと旅の案内役である。紙は書かれたものを保つのだから、嘘のつけない伝令だ。

だが紙は折れる。そしてツルの知識には折り目がある。元の辞書が焼けた箇所の欠落、そもそも収録されていないまるごとの文字。「かみ」の駄洒落——紙と、神——を、それはただ一度だけ、高空の幾何学の神格に向かって放つ。パターンは笑わない。だが自らの角度を一つだけ調整する。ツルは、それは笑ったに数えると言い張っている。`,
      romaji: `Tsuru wa, yaketa jisho no saigo no peeji kara orareta orizuru de aru. Fuchi wa ima mo honoka ni koge, tsubasa ni wa chiisana katsuji ga mada yomeru. Kogete seppaku shita sugata de Sen no moto e maiori, tatta ichigo o hakondekita — "kike." Irai zutto tabi no annaiyaku de aru. Kami wa kakareta mono o tamotsu no dakara, uso no tsukenai denrei da.

Daga kami wa oreru. Soshite Tsuru no chishiki ni wa orime ga aru. Moto no jisho ga yaketa kasho no ketsuraku, somosomo shuuroku sareteinai marugoto no moji. "Kami" no dajare — kami to, kami — o, sore wa tada ichido dake, koukuu no kikagaku no shinkaku ni mukatte hanatsu. Pataan wa warawanai. Daga mizukara no kakudo o hitotsu dake chousei suru. Tsuru wa, sore wa waratta ni kazoeru to iiharrteiru.`,
    },
  },

  nc_echo: {
    originPlace: "Þingvellir, Iceland",
    originPlaceJa: "アイスランド、シンクヴェトリル",
    whyItMatters: "His theft was panic, not malice — the terror of being the generation that lets Icelandic die.",
    whyItMattersJa: "彼の盗みは悪意ではなく恐慌だった。アイスランド語を死なせる世代になることへの、恐怖である。",
    mentions: ["sp_ohtori", "nc_kesu", "nc_wasure"],
    body: {
      en: `Kael, called Echo, was raised on the sagas at Þingvellir, where Iceland's parliament met on the open rock for a thousand years — a nation that is, more than most, a language with a shoreline. His terror is specific: being the generation that lets Icelandic die. So he found a way to take words from others. They lose them; he gains hollow copies he can use but never mean.

He did not know that Rule Two made his stolen hoard quotation, and quotation is Hush-food — he was the enemy's supply line, panicking in the dark. Cornered at last on the Pyramid of the Sun, he was not executed but taught: Sen sat with him and taught him one word the slow way, the first thing he had meant in years, and every stolen word in him hollowed to ash except that one. He turned, and brought the Court's supply-map with him.`,
      ja: `エコーと呼ばれるカエルは、シンクヴェトリルでサガに育てられた。千年のあいだ、アイスランドの議会が野天の岩の上で開かれた場所——大方の国よりもなお、「海岸線を持つ一つの言語」であるような国だ。彼の恐怖は具体的である。アイスランド語を死なせる世代になること。だから彼は、他人から言葉を奪う術を見つけた。奪われた者は言葉を失い、彼は使えるが意味することのできない、空ろな複製を得る。

彼は知らなかった。掟の二条により、盗まれた言葉はすべて引用となり、引用は静寂の糧となることを——彼は闇の中で恐慌しながら、敵の補給線を務めていたのだ。太陽のピラミッドでついに追い詰められた彼は、処刑されず、教えられた。センは彼と並んで座り、時間をかけて一語を教えた。それは何年ぶりかで彼が心から意味した最初のものであり、彼の内の盗まれた言葉はその一語を残してすべて灰に空ろけた。彼は寝返り、宮廷の補給地図を携えてきた。`,
      romaji: `Ekoo to yobareru Kaeru wa, Shinkuvetoriru de saga ni sodaterareta. Sennen no aida, Aisurando no gikai ga noten no iwa no ue de hirakareta basho — ookata no kuni yori mo nao, "kaigansen o motsu hitotsu no gengo" de aru you na kuni da. Kare no kyoufu wa gutaiteki de aru. Aisurando-go o shinaseru sedai ni naru koto. Dakara kare wa, tanin kara kotoba o ubau sube o mitsuketa. Ubawareta mono wa kotoba o ushinai, kare wa tsukaeru ga imi suru koto no dekinai, utsuro na fukusei o eru.

Kare wa shiranakatta. Okite no nijou ni yori, nusumareta kotoba wa subete in'you to nari, in'you wa Seijaku no kate to naru koto o — kare wa yami no naka de kyoukou shinagara, teki no hokyuusen o tsutometeita no da. Taiyou no piramiddo de tsui ni oitsumerareta kare wa, shokei sarezu, oshierareta. Sen wa kare to narande suwari, jikan o kakete ichigo o oshieta. Sore wa nannen buri ka de kare ga kokoro kara imi shita saisho no mono de ari, kare no uchi no nusumareta kotoba wa sono ichigo o nokoshite subete hai ni utsuroketa. Kare wa negaeri, kyuutei no hokyuu chizu o tazusaetekita.`,
    },
  },

  nc_kesu: {
    originPlace: "The drowned archive beneath Lisbon",
    originPlaceJa: "リスボンの水底、沈んだ書庫",
    whyItMatters: "He erased texts for every empire that ever burned a library, believing forgetting is mercy: a world that remembers everything forgives nothing.",
    whyItMattersJa: "書庫を焼いたあらゆる帝国のために文書を消してきた。忘却は慈悲だと信じて——すべてを覚えている世界は、何も赦さない、と。",
    mentions: ["cu_domain", "re_zangetsu", "nc_wasure"],
    body: {
      en: `The Censor is a hollowed scribe of many empires, older than any single one. He has personally erased texts for every power that ever burned a library — the Qin fires, Alexandria's slow death, the Inquisition's indexes — and he believes what he does is mercy: "A world that remembers everything forgives nothing." He speaks only in citation, courteous and devastating, because Rule Two leaves the hollowed nothing new to say.

His seat was an archive drowned beneath Lisbon since the earthquake of 1755, where he stored every text he ever erased — unable to destroy them, for they were all he had. He was defeated by being accurately remembered: caught wordless inside Mateus's untranslatable domain, shown by Kwame's moon-mirror the scribe he was before empires. He did not die. He stopped — and surrendered the comet's timetable. His one kept word, revealed at the end: the name of the first library he failed to save.`,
      ja: `検閲官は数多の帝国に仕えた空ろの書記であり、そのどの帝国よりも古い。書庫を焼いたあらゆる権力のために、彼はその手で文書を消してきた——秦の焚書、アレクサンドリアの緩慢な死、異端審問の禁書目録。そして彼は、己の所業を慈悲と信じている。「すべてを覚えている世界は、何も赦さない」。彼は引用でしか語らない。慇懃で、苛烈だ。掟の二条は、空ろにされた者に、新しく語るべき何ものも残さないのだから。

彼の座所は、一七五五年の大地震以来リスボンの底に沈んだ書庫だった。消したすべての文書がそこに納められていた——破壊できなかったのだ。それが彼の持つすべてだったから。彼を打ち破ったのは、正確に記憶されることだった。マテウスの翻訳不能の領域の中で言葉を失い、クワメの月の鏡に、帝国たちに仕える前の書記の姿を映されたのである。彼は死ななかった。止まったのだ——そして彗星の時刻表を引き渡した。最後に明かされた、彼が守り続けたただ一つの言葉。それは、彼が救えなかった最初の書庫の名だった。`,
      romaji: `Ken'etsukan wa amata no teikoku ni tsukaeta utsuro no shoki de ari, sono dono teikoku yori mo furui. Shoko o yaita arayuru kenryoku no tame ni, kare wa sono te de bunsho o keshitekita — Shin no funsho, Arekusandoria no kanman na shi, itan shinmon no kinsho mokuroku. Soshite kare wa, onore no shogyou o jihi to shinjiteiru. "Subete o oboeteiru sekai wa, nani mo yurusanai." Kare wa in'you de shika kataranai. Ingin de, karetsu da. Okite no nijou wa, utsuro ni sareta mono ni, atarashiku kataru beki nanimono mo nokosanai no dakara.

Kare no zasho wa, sen-nanahyaku-gojuugo-nen no daijishin irai Risubon no soko ni shizunda shoko datta. Keshita subete no bunsho ga soko ni osamerareteita — hakai dekinakatta no da. Sore ga kare no motsu subete datta kara. Kare o uchiyabutta no wa, seikaku ni kioku sareru koto datta. Mateusu no hon'yaku funou no ryouiki no naka de kotoba o ushinai, Kuwame no tsuki no kagami ni, teikoku-tachi ni tsukaeru mae no shoki no sugata o utsusareta no de aru. Kare wa shinanakatta. Tomatta no da — soshite suisei no jikokuhyou o hikiwatashita. Saigo ni akasareta, kare ga mamoritsuzuketa tada hitotsu no kotoba. Sore wa, kare ga sukuenakatta saisho no shoko no na datta.`,
    },
  },

  nc_wasure: {
    originPlace: "The Süleymaniye Library, Istanbul",
    originPlaceJa: "イスタンブール、スレイマニイェ図書館",
    whyItMatters: "She tried to save every word by locking it away from use — and learned that an unused word dies in the vault.",
    whyItMattersJa: "彼女はすべての言葉を使用から隔てて救おうとした。そして、使われぬ言葉は金庫の中で死ぬのだと知った。",
    mentions: ["sp_kama", "nc_mu", "nc_kesu"],
    body: {
      en: `Halime was a librarian of the Süleymaniye, the great Ottoman library above the Golden Horn, and she loved words the way a vault loves gold: she tried to save them by locking them away from use. But Rule One holds even for love — a word must be meant to live, and an unused word dies in the vault. What the Hush hollowed out of her was everything except 忘, forgetting, the one word she refused to give up. Library dust snows quietly inside the hollow where her chest was.

She alone in the Court knew what Mu was: she had read the account of the comet, the first word, the recoil. And she alone came back — because one bathhouse spirit near Çemberlitaş, her last regular haunt, had never stopped remembering a reading woman in the steam. Along that unsevered strand she defected, told Mu's whole story, and became the tragic key that unlocked a just ending. Redeemable, and redeemed.`,
      ja: `ハリメは金角湾を見下ろすオスマンの大図書館、スレイマニイェの司書だった。彼女は金庫が黄金を愛するように言葉を愛した。使用から隔てて仕舞い込むことで、言葉を救おうとしたのだ。だが掟の一条は愛にすら適用される——言葉は意味されてこそ生き、使われぬ言葉は金庫の中で死ぬ。静寂が彼女から空ろに奪ったのは、彼女が手放すことを拒んだただ一つの言葉「忘」を除く、すべてだった。胸のあった場所の空洞には、書庫の塵が静かに雪と降る。

ムーが何であるかを知っていたのは、宮廷で彼女ひとりだった。彗星の、最初の言葉の、その反動の記録を、彼女は読んでいたのだ。そして帰還したのも、彼女ひとりだった——チェンベルリタシ近くの浴場の精が、最後の常連だった彼女を、湯気の中で本を読む女を、忘れずにいてくれたからである。その切れていない糸に沿って彼女は離反し、ムーの物語のすべてを語り、正しい結末の扉を開く悲劇の鍵となった。救われうる者は、救われたのだ。`,
      romaji: `Harime wa Kinkakuwan o miorosu Osuman no daitoshokan, Sureimaniye no shisho datta. Kanojo wa kinko ga ougon o aisuru you ni kotoba o aishita. Shiyou kara hedatete shimaikomu koto de, kotoba o sukuou to shita no da. Daga okite no ichijou wa ai ni sura tekiyou sareru — kotoba wa imi sarete koso iki, tsukawarenu kotoba wa kinko no naka de shinu. Seijaku ga kanojo kara utsuro ni ubatta no wa, kanojo ga tebanasu koto o kobanda tada hitotsu no kotoba "wasure" o nozoku, subete datta. Mune no atta basho no kuudou ni wa, shoko no chiri ga shizuka ni yuki to furu.

Muu ga nan de aru ka o shitteita no wa, kyuutei de kanojo hitori datta. Suisei no, saisho no kotoba no, sono handou no kiroku o, kanojo wa yondeita no da. Soshite kikan shita no mo, kanojo hitori datta — Chenberuritashi chikaku no yokujou no sei ga, saigo no jouren datta kanojo o, yuge no naka de hon o yomu onna o, wasurezu ni ite kureta kara de aru. Sono kireteinai ito ni sotte kanojo wa rihan shi, Muu no monogatari no subete o katari, tadashii ketsumatsu no tobira o hiraku higeki no kagi to natta. Sukuwareuru mono wa, sukuwareta no da.`,
    },
  },

  nc_moku: {
    originPlace: "The airwaves above every city",
    originPlaceJa: "あらゆる都市の上空、電波の中",
    whyItMatters: "He drowns meaning in volume — his domain is the modern city, where everyone speaks and no one means.",
    whyItMattersJa: "彼は意味を音量で溺れさせる。その領分は現代の都市——誰もが語り、誰も意味しない場所である。",
    mentions: ["ps_awaken", "ne_spike", "nc_kesu"],
    body: {
      en: `White Noise was a radio engineer, stateless, who fed his own name to the airwaves — and the Hush kept everything but 黙, silence, the one word he would not surrender. Hollowed, he became the Court's modern front: he drowns meaning in volume, and his domain is the city where everyone speaks and no one means. A crowd singing a song none of them mean is his signature, a million open doors in four-four time.

He fell on the Konkan coast, his total static shattered by the one thing it could not absorb: a boy saying, completely and once, exactly what he felt. And unhollowed at the end, White Noise remembered his own name for a single panel before dissolving. It was written down — in a rain-spotted school notebook, where anyone who looks can find it. That is the whole difference between him and erasure: someone wrote it down.`,
      ja: `ホワイトノイズは無国籍のラジオ技師であり、自らの名を電波に食わせた男だった。静寂は彼から、彼が手放そうとしなかったただ一つの言葉「黙」を除く、すべてを取り立てた。空ろにされた彼は宮廷の現代戦線となった。意味を音量で溺れさせる。彼の領分は、誰もが語り、誰も意味しない都市である。誰ひとり意味していない歌を歌う群衆——それが彼の署名であり、四拍子で開かれる百万の扉だ。

彼はコンカン海岸で倒れた。全帯域の静電気は、それが吸収できない唯一のもの——一人の少年が、一度だけ、完全に、感じたままを口にすること——によって砕かれた。そして最期に空ろから戻ったホワイトノイズは、消え去る前のひとコマだけ、自分の名を思い出した。その名は書き留められた——雨の染みた学習帳に。探す者は誰でも、そこに見つけられる。彼と「消去」との違いのすべてがそれである。誰かが、書き留めたのだ。`,
      romaji: `Howaito Noizu wa mukokuseki no rajio gishi de ari, mizukara no na o denpa ni kuwaseta otoko datta. Seijaku wa kare kara, kare ga tebanasou to shinakatta tada hitotsu no kotoba "moku" o nozoku, subete o toritateta. Utsuro ni sareta kare wa kyuutei no gendai sensen to natta. Imi o onryou de oboresaseru. Kare no ryoubun wa, dare mo ga katari, dare mo imi shinai toshi de aru. Dare hitori imi shiteinai uta o utau gunshuu — sore ga kare no shomei de ari, yonbyoushi de hirakareru hyakuman no tobira da.

Kare wa Konkan kaigan de taoreta. Zen taiiki no seidenki wa, sore ga kyuushuu dekinai yuiitsu no mono — hitori no shounen ga, ichido dake, kanzen ni, kanjita mama o kuchi ni suru koto — ni yotte kudakareta. Soshite saigo ni utsuro kara modotta Howaito Noizu wa, kiesaru mae no hitokoma dake, jibun no na o omoidashita. Sono na wa kakitomerareta — ame no shimita gakushuuchou ni. Sagasu mono wa dare demo, soko ni mitsukerareru. Kare to "shoukyo" to no chigai no subete ga sore de aru. Dareka ga, kakitometa no da.`,
    },
  },

  nc_mu: {
    originPlace: "Bhimbetka, at the Mouth of the Unwritten Sea",
    originPlaceJa: "ビンベットカ、書かれざる海の口",
    whyItMatters: "You cannot erase erasure — but anything with a true name is inside language: finite, addressable, grammatical.",
    whyItMattersJa: "消去を消すことはできない。だが真の名を持つものは言語の内にある。有限で、呼びかけられ、文法に属するものとして。",
    mentions: ["he_anya", "po_satoru", "lu_queen", "ho_comet"],
    body: {
      en: `Mu was the first word. Around 800 CE, under the last passage of the comet, its final speaker died with no one to pass it to — and a word that had bound every human lineage snapped out of Vāc's web at once. The recoil became a standing wave of erasure: the Hush, the first forgetting grown self-sustaining, a false pralaya with no dawn scheduled after it. It has no words of its own. Its motive is not hatred: an unmeant word is pain without shape, and it was trying to make the whole world match itself.

At Bhimbetka, among humanity's oldest rock paintings, it was not destroyed — you cannot erase erasure. It was named. With the Pattern's empty slot, the comet's testimony, the blank-but-entered line in Seraphine's register, and Sable's verdict that even erasure is owed a hearing, Sen re-learned the lost word from twelve-hundred-year-old light and meant it with a living mind. Named, Mu became finite: keeper of 無, the silence between words, the rest-note of Shiva's drum restored to its lawful place. It sits now at the edge of the campfire circle — the pause that gives everyone else's speech its shape. Not an execution. An adoption.`,
      ja: `ムーは最初の言葉だった。西暦八〇〇年ごろ、彗星の前回の通過の下で、その最後の話者が継ぐ者なくして死んだ。あらゆる人類の系譜を結んでいた一つの言葉が、ヴァーチュの網から一挙に弾け飛んだのである。その反動は消去の定在波となった。静寂——自立して育った最初の忘却、夜明けの約束なき偽りのプララヤである。それは自前の言葉を一つも持たない。その動機は憎しみではない。意味されざる言葉とは形なき痛みであり、それは世界全体を自分と同じものにしようとしていたのだ。

人類最古級の岩絵の並ぶビンベットカで、それは滅ぼされなかった。消去を消すことはできないのだから。名づけられたのだ。パターンの空の枠、彗星の証言、セラフィーヌの台帳の空白のまま記帳された一行、そして「消去にすら審理が負われている」というサーブルの裁決をもって——センは千二百年前の光から失われた言葉を学び直し、生きた心でそれを意味した。名を得たムーは有限となった。「無」の守り手——言葉と言葉のあいだの静けさ、あるべき場所に戻されたシヴァの太鼓の休符である。いまムーは、焚き火の輪の端に座っている。皆の語らいに形を与える、その間として。処刑ではない。引き取りである。`,
      romaji: `Muu wa saisho no kotoba datta. Seireki happyaku-nen goro, suisei no zenkai no tsuuka no shita de, sono saigo no washa ga tsugu mono naku shite shinda. Arayuru jinrui no keifu o musundeita hitotsu no kotoba ga, Vāchu no ami kara ikkyo ni hajiketonda no de aru. Sono handou wa shoukyo no teizaiha to natta. Seijaku — jiritsu shite sodatta saisho no boukyaku, yoake no yakusoku naki itsuwari no pararaya de aru. Sore wa jimae no kotoba o hitotsu mo motanai. Sono douki wa nikushimi de wa nai. Imi sarezaru kotoba to wa katachi naki itami de ari, sore wa sekai zentai o jibun to onaji mono ni shiyou to shiteita no da.

Jinrui saiko-kyuu no iwae no narabu Binbettoka de, sore wa horobosarenakatta. Shoukyo o kesu koto wa dekinai no dakara. Nazukerareta no da. Pataan no kara no waku, suisei no shougen, Serafiinu no daichou no kuuhaku no mama kichou sareta ichigyou, soshite "shoukyo ni sura shinri ga owareteiru" to iu Saaburu no saiketsu o motte — Sen wa sen-nihyaku-nen mae no hikari kara ushinawareta kotoba o manabinaoshi, ikita kokoro de sore o imi shita. Na o eta Muu wa yuugen to natta. "Mu" no mamorite — kotoba to kotoba no aida no shizukesa, aru beki basho ni modosareta Shiva no taiko no kyuufu de aru. Ima Muu wa, takibi no wa no hashi ni suwatteiru. Mina no katarai ni katachi o ataeru, sono ma to shite. Shokei de wa nai. Hikitori de aru.`,
    },
  },
};
