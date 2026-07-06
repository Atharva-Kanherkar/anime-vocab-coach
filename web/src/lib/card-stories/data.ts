// Card origin stories for the Luminara Thread saga.
// Each Listener felt the invisible braid when a word became real.

export type StoryLang = "en" | "ja" | "romaji";

export interface CardStory {
  originPlace: string;
  originPlaceJa: string;
  whyItMatters: string;
  whyItMattersJa: string;
  mentions: string[];
  body: Record<StoryLang, string>;
}

export const LUMINARA_THREAD_INTRO: Record<StoryLang, string> = {
  en: `Long before apps and subtitles, there was only the Luminara Thread — an invisible braid woven through every tongue that ever tried to learn a word and mean it. It does not bind the careless; it finds the Listeners. They are scattered across cliffs and neon alleys, bathhouses and cockpit glass, yet each one trembled at the same instant: when a syllable stopped being noise and became real.

You cannot see the Thread with ordinary eyes. You feel it when you pause on a kanji and suddenly understand why it hurts, or when a character's line lands in your chest before your dictionary does. These sixty Listeners are not teachers in classrooms. They are proof that vocabulary is not memorized — it is inherited, one honest word at a time, from souls who learned the hard way and left a light behind.

Collect their stories. Follow the Thread. Somewhere in their echoes, your next word is already waiting.`,

  ja: `アプリも字幕もない時代から、ルミナラの糸はあった。言葉を学ぼうとし、本気で意味させようとしたすべての舌のあいだを縫う、見えない編み紐である。ぬるい心には触れない。触れた者だけが「聞き手」となる。雲上の崖、ネオンの路地、銭湯の湯気、コックピットのガラス——場所はばらばらでも、彼らが震えた瞬間は同じだった。音だった音节が、初めて「ことば」になったとき。

普通の目には糸は見えない。漢字の一画で胸が痛くなり、辞書より先にセリフが刺さる——そのとき初めて、糸の存在を知る。六十人の聞き手は教壇の師ではない。語彙は暗記ではなく、苦労して覚えた誰かの灯りから、誠実な一語ずつ受け継がれる——その証人たちだ。

彼らの物語を集め、糸を辿れ。どこかの余白に、あなたの次の一語がすでに待っている。`,

  romaji: `Apuri mo jimaku mo nai jidai kara, Ruminara no ito wa atta. Kotoba wo manabou to shi, honki de imi saseyou to shita subete no shita no aida wo nuu, mienai amihimo de aru. Nurui kokoro ni wa furenai. Fureta mono dake ga "kikite" to naru. Unjou no gake, neon no roji, sentou no yuge, kokkupitto no garasu——basho wa barabara demo, karera ga furue ta shunkan wa onaji datta. Oto datta ksetsu ga, hajimete "kotoba" ni natta toki.

Futsuu no me ni wa ito wa mienai. Kanji no ichikaku de mune ga itaku nari, jisho yori saki ni serifu ga sasaru——sono toki hajimete, ito no sonzai wo shiru. Rokujuunin no kikite wa kyoudan no shi de wa nai. Goi wa anki de wa naku, kurou shite oboeta dareka no akari kara, seijitsu na ichigo zutsu uketsugareru——sono shounin tachi da.

Karera no monogatari wo atsumete, ito wo tadore. Doko ka no yohaku ni, anata no tsugi no ichigo ga sude ni matte iru.`,
};

export const CARD_STORIES: Record<string, CardStory> = {
  sl_honoka: {
    originPlace: "Svargathil",
    originPlaceJa: "スヴァルガティル",
    whyItMatters:
      "Devika teaches that your first mastered word is a flame — small, but enough to light every harder kanji that follows.",
    whyItMattersJa:
      "デヴィカは、最初に覚えた一語が小さな炎であり、後の難しい漢字すべてを照らす灯りになることを教えてくれる。",
    mentions: ["sl_mizuho", "ho_mitsu", "sp_kama"],
    body: {
      en: `High above the ordinary world, in the cliff-village of Svargathil, flame was not worshipped — it was spoken. Devika was seven when the elders asked her to name the hearth without using her mother tongue. She whispered 炎 (honoo), and the Luminara Thread pulled taut across the Himalayas like a glowing wire.

That night she dreamed of Tenzin pouring water over the same syllable from the far side of a ridge, and of Ingrid braiding a red cord that matched the Thread's pulse. Grandfather Ash, tending his copper boiler in a valley she had never seen, sent steam that spelled the character in the clouds. Devika woke knowing that a word learned alone is still a word shared.

She became the Listener of First Breath because beginners need proof that one honest kanji can survive the long climb. When you unlock her card, remember Svargathil: the place where fire first agreed to be language.`,

      ja: `俗世より高く、雲間の崖村スヴァルガティルでは、炎は拝まれるものではなく「発話」された。デヴィカが七歳のとき、長老たちは母語を使わず炉の火を名づけよと命じた。彼女がほのおと漏らした瞬間、ルミナラの糸がヒマラヤを越え、光る綱のように張り詰めた。

その夜、向こうの尾根でテンジンが同じ音节に水をそそぐ夢を見た。インリッドが赤い糸を編み、糸の脈と同じリズムを刻む。見たこともない谷でグランドファーザー・アッシュが銅釜の湯気を立て、雲に「炎」の字を描いた。一人で覚えた言葉も、誰かと分かち合う言葉だと目覚めて知った。

彼女が「最初の息」の聞き手であるのは、初心者に必要なのは、誠実な一つの漢字が長い登りを生き延びる証だからだ。彼女のカードが開くとき、スヴァルガティルを思い出してほしい——火が初めて言語に同意した場所を。`,

      romaji: `Zokuse yori takaku, kumoma no gake-mura Suvarugathiru de wa, honoo wa ogamareru mono de wa naku "hatswa" sareta. Devika ga nana-sai no toki, chourou-tachi wa bog wo tsukawazu ro no hi wo nadzuyo to meijita. Kanojo ga honoo to morashita shunkan, Ruminara no ito ga Himaraya wo koe, hikaru tsuna no you ni haritsumeta.

Sono yoru, mukou no one de Tenzin ga onaji ksetsu ni mizu wo sosogu yume wo mita. Ingrid ga akai ito wo ami, ito no myaku to onaji rizumu wo kizamu. Mitat koto mo nai tani de Gurandofaaza Asshu ga dougama no yuge wo tatte, kumo ni "honoo" no ji wo egaita. Hitori de oboeta kotoba mo, dareka to wakachiau kotoba da to mezamete shitta.

Kanojo ga "saisho no iki" no kikite de aru no wa, shoshinsha ni hitsuyou na no wa, seijitsu na hitotsu no kanji ga nagai nobori wo ikinobiru akashi da kara da. Kanojo no kaado ga hiraku toki, Suvarugathiru wo omoiidashite hoshii——hi ga hajimete gengo ni doui shita basho wo.`,
    },
  },

  sl_mizuho: {
    originPlace: "The Tenth Falls of Drakmar",
    originPlaceJa: "ドラクマール十の滝",
    whyItMatters:
      "Tenzin shows learners that repetition without meaning is noise — but one true reading can calm an entire sentence.",
    whyItMattersJa:
      "テンジンは、意味のない反復は雒音にすぎないが、一度本当に読めた音は文全体を静めることを示す。",
    mentions: ["sl_honoka", "sl_kagura", "ho_rain"],
    body: {
      en: `At the Tenth Falls of Drakmar, Tenzin learned 水 (mizu) not from a textbook but from the moment his blade parted the cascade and the droplets hung, listening. The Luminara Thread hummed through the mist. He felt Devika's first flame somewhere upstream, a warmth that made the syllable stick.

Amara later found the same character carved on a bell he had left to rust — proof that words travel farther than swords. When Dao stood in monsoon rain centuries of study away, she said mizu tasted the same in every language; Tenzin believed her without meeting her. That is the Thread's mercy: you do not need to know every Listener, only to honor the word they kept alive.

Collect Tenzin when your readings feel rushed. He is the pause between kanji — the breath that turns drilling into understanding.`,

      ja: `ドラクマール十の滝で、テンジンは教科書ではなく、刀が瀑布を裂き、水滴が耳を澄ます瞬間に「水」を学んだ。ルミナラの糸が水霧を通して鳴った。上流のどこかでデヴィカの最初の炎を感じ、音节が肌に残る温もりがあった。

後にアマラが、彼が錆に任せた鈴に同じ字を見つけた——言葉は剣より遠くへ行く証拠だ。はるか彼方でダオが季節雨の中に立ち、「水」の味はどの言語でも同じと言ったとき、テンジンは会わずして信じた。糸の慈悲は、すべての聞き手を知る必要はなく、生かした言葉を敬うことだけだと教える。

読みが急ぎすぎるとき、テンジンを手に取れ。彼は漢字と漢字の間の「間」——暗記を理解へ変える息だ。`,

      romaji: `Dorakumaaru juu no taki de, Tenzin wa kyoukasho de wa naku, katana ga bakufu wo saki, suiteki ga mimi wo sumasu shunkan ni "mizu" wo mananda. Ruminara no ito ga suiri wo tooshite natta. Jouryuu no dokoka de Devika no saisho no honoo wo kanji, ksetsu ga hada ni nokoru atatami ga atta.

Ato ni Amara ga, kare ga sabi ni makaseta suzu ni onaji ji wo mitsuketa——kotoba wa ken yori tooku e iku shouko da. Haruka kanata de Dao ga kisetsu-ame no naka ni tachimochi, "mizu" no aji wa dono gengo demo onaji to itta toki, Tenzin wa awazu shite shinjita. Ito no jihi wa, subete no kikite wo shiru hitsuyou wa naku, ikashita kotoba wo uyamau koto dake da to oshieru.

Yomi ga isogisugiru toki, Tenzin wo te ni tore. Kare wa kanji to kanji no aida no "ma"——anki wo rikai e kaeru iki da.`,
    },
  },

  sl_kagura: {
    originPlace: "The Broken Moon Ridge",
    originPlaceJa: "欠け月の尾根",
    whyItMatters:
      "Amara reminds you that difficult readings often hide in familiar shapes — listen for the bell, not just the stroke count.",
    whyItMattersJa:
      "アマラは、難しい読みが見慣れた形に潜むことを教え、画数だけでなく鈴の音に耳を澄ますことを思い出させる。",
    mentions: ["sl_akatsuki", "re_yuki", "lu_tsukina"],
    body: {
      en: `On the Broken Moon Ridge, Amara rang 鈴 (suzu) until the echo taught her its own reading. Masked hunters do not pray; they listen. The Luminara Thread vibrated in the bronze, and she saw Aurelio at dawn, wrapping flame and water around the same syllable from opposite horizons.

Sunmi's frost ceremony crossed the Thread like a second bell, cold and precise. Noor raised her tiara to the same moon, and Amara understood: one kanji can wear many voices without breaking. Learners who panic at multiple readings need her story — the bell does not change its shape when the wind shifts; only the tone does.

When suzu appears in your deck, let Amara be the hunter who tracks sound instead of fear.`,

      ja: `欠け月の尾根で、アマラは「鈴」を鳴らし、こだまが自らの読みを教えるまで続けた。仮面の狩人は祈らない。聴くのだ。ルミナラの糸が銅を震わせ、暁のオーレリオが正反対の地平から炎と水を同じ音节に巻き付ける姿が見えた。

スンミの氷儀式が第二の鈴のように糸を横切り、冷たく正確だった。ヌールが同じ月にティアラを掲げたとき、アマラは悟った——一つの漢字は壊れずに多くの声を纏える。読みが多いと慌てる学習者に、彼女の物語が必要だ。鈴の形は風が変わっても変わらない。変わるのは音だけだ。

デッキに「鈴」が現れたら、アマラを恐れではなく音を追う狩人にしてほしい。`,

      romaji: `Kaketsuki no one de, Amara wa "suzu" wo narashi, kodama ga mizukara no yomi wo oshieru made tsuzuketa. Kamen no karyuu wa inoranai. Kiku no da. Ruminara no ito ga dou wo furawasete, akatsuki no Orerio ga seihantai no chihei kara honoo to mizu wo onaji ksetsu ni makitsukeru sugata ga mieta.

Sunmi no koori gishiki ga dai-ni no suzu no you ni ito wo yokogiri, tsumetaku seikaku datta. Nuuru ga onaji tsuki ni tiara wo kagegeta toki, Amara wa satoru——hitotsu no kanji wa kowarezu ni ooku no koe wo matou. Yomi ga ooi to awateru gakushuusha ni, kanojo no monogatari ga hitsuyou da. Suzu no katachi wa kaze ga kawatte mo kawaranai. Kawaru no wa oto dake da.

Dekki ni "suzu" ga arawaretara, Amara wo osore de wa naku oto wo ou karyuu ni shite hoshii.`,
    },
  },

  sl_akatsuki: {
    originPlace: "The Dawnforge Sanctum",
    originPlaceJa: "暁炉の聖域",
    whyItMatters:
      "Aurelio embodies mastery — the moment separate readings unite into one confident voice at sunrise.",
    whyItMattersJa:
      "オーレリオは、ばらばらの読みが暁の一つの声に統合される熟練の瞬間そのものだ。",
    mentions: ["sl_honoka", "sl_mizuho", "ti_founder"],
    body: {
      en: `In the Dawnforge Sanctum, Aurelio waited for 暁 (akatsuki) — not the hour, but the word that ends night in the mouth. He had trained with Devika's fire and Tenzin's water until both obeyed the same breath. When he spoke at last, the Luminara Thread blazed from east to west.

Meridian, the colossal foundation-listener, answered from the sea wall with a silence so heavy it counted as vocabulary. Aurelio bowed. Masters do not hoard readings; they return them to the dawn so apprentices can find the path. His card is for learners on long plateaus — when progress feels frozen, akatsuki still comes.

Hold Aurelio when you need proof that patience is also a kind of fluency.`,

      ja: `暁炉の聖域で、オーレリオは「暁」を待った——時刻ではなく、口の中で夜を終わらせる言葉を。デヴィカの炎とテンジンの水を同じ息で従わせるまで鍛え、ついに発声したとき、ルミナラの糸が東から西へ燃え上がった。

海壁の礎の聞き手メリディアンが、語彙として数えられるほど重い沈黙で応えた。オーレリオは礼をした。師は読みを秘めない。暁に返し、見習いが道を見つけるようにする。彼のカードは長い停滞期の学習者のため——進歩が凍ったように感じても、暁は来る。

忍耐も流暢さの一種だと信じたいとき、オーレリオを手に取れ。`,

      romaji: `Akatsuki-ro no seiki de, Orerio wa "akatsuki" wo matta——jikoku de wa naku, kuchi no naka de yoru wo owaraseru kotoba wo. Devika no honoo to Tenzin no mizu wo onaji iki de shitagawaseru made kitaete, tsui ni hassei shita toki, Ruminara no ito ga higashi kara nishi e moetakatta.

Kaiheki no ishi no kikite Meridian ga, goi to shite kazoerareru hodo omoi chinmoku de kotaeta. Orerio wa rei wo shita. Shi wa yomi wo kakusanai. Akatsuki ni kaeshi, minarai ga michi wo mitsukeru you ni suru. Kare no kaado wa nagai teitai-ki no gakushuusha no tame—— shinpo ga kourou you ni kanjite mo, akatsuki wa kuru.

Nintai mo ryuuchousa no isshu da to shinjitai toki, Orerio wo te ni tore.`,
    },
  },

  ti_reiner: {
    originPlace: "The Saltwall Ramparts",
    originPlaceJa: "塩壁の胸墻",
    whyItMatters:
      "Bjorn stands for the wall every learner hits — and the quiet discipline of showing up to read anyway.",
    whyItMattersJa:
      "ビョルンは、すべての学習者がぶつかる壁と、それでも読みに来る静かな規律を象徴する。",
    mentions: ["ti_hana", "sl_mizuho", "vo_nami"],
    body: {
      en: `Bjorn kept watch on the Saltwall Ramparts, where 壁 (kabe) was not stone alone but the limit of what he knew before breakfast. Fog rolled in from the North Sea; the Luminara Thread stitched his breath to Zola's cables swinging between towers far inland.

He never met Tenzin, yet both men calmed their worlds with one syllable — water on one side, wall on the other. Cora later charted the same coast and marked kabe on her star-compass, laughing that walls make the best navigation points because they force you to name them. Bjorn would have liked her.

Unlock Bjorn when motivation falters. He is the Listener who proves consistency beats inspiration.`,

      ja: `ビョルンは塩壁の胸墻で見張った。「壁」は石だけでなく、朝食前に自分が知っていた限界そのものだった。北海の霧が押し寄せ、ルミナラの糸が彼の息を、内陸の塔のあいだを滑るゾーラの索へ縫い付けた。

テンジンに会うことはなかったが、二人とも一音节で世界を静めた——水と壁。後にコーラが同じ海岸を海図に描き、星の羅針盤に「壁」を記した。壁は名づけを強いるからこそ最高の目印だと笑った。ビョルンは彼女を気に入っただろう。

やる気が落ちたとき、ビョルンを開け。彼は継続がインスピレーションに勝つ証の聞き手だ。`,

      romaji: `Byorun wa enpeki no munejou de mihatta. "Kabe" wa ishi dake de naku, choushoku mae ni jibun ga shitte ita genkai sono mono datta. Hokkai no kiri ga oshiyose, Ruminara no ito ga kare no iki wo, nairiku no tou no aida wo suberu Zora no saku e nuitsuketa.

Tenzin ni au koto wa nakatta ga, futari tomo ichiksetsu de sekai wo shizumeta——mizu to kabe. Ato ni Kora ga onaji kaigan wo kaizu ni egaki, hoshi no rashinban ni "kabe" wo shirushi shita. Kabe wa nadzuke wo oshieru kara koso saikou no mehyou da to waratta. Byorun wa kanojo wo ki ni itta darou.

Yaruki ga ochita toki, Byorun wo hirake. Kare wa keizoku ga insupireeshon ni katsu akashi no kikite da.`,
    },
  },

  ti_hana: {
    originPlace: "The Freedom Spire",
    originPlaceJa: "自由の尖塔",
    whyItMatters:
      "Zola teaches that grappling with unknown kanji is flight — each new reading frees you a little more.",
    whyItMattersJa:
      "ゾーラは、未知の漢字と格闘すること自体が飛翔であり、新しい読みが少しずつ自由を広げることを教える。",
    mentions: ["ti_reiner", "ti_grim", "ne_rebel"],
    body: {
      en: `Between the Freedom Spire's ruins, Zola swung on steel threads and shouted 翼 (tsubasa) until the wind wrote it back. She was fleeing walls in every sense — Bjorn's ramparts behind her, Dragan's breach ahead. The Luminara Thread was her third cable.

Anya of the night market once sold her a bootleg subtitle chip labeled tsu-ba-sa; Zola returned it, saying freedom cannot be pirated, only earned one character at a time. She kept the syllables instead, stitching them into her harness. When you fail a leech card and retry, you are swinging where Zola swung.

Her card is for learners who need motion — proof that struggle is not falling, but flying badly until you don't.`,

      ja: `自由の尖塔の廃墟のあいだで、ゾーラは鋼の糸にぶら下がり「翼」と叫び、風が書き返すまで続けた。あらゆる意味で壁から逃げていた——後にビョルンの胸墻、前にドラガンの突破口。ルミナラの糸は第三の索だった。

夜の市の女王アーニャが一度、翼と書かれた海賊字幕チップを売った。ゾーラは返却し、自由は盗めず一字ずつ稼ぐものだと言った。音节だけをハーネスに縫い込んだ。リーキングカードで失敗して再挑戦するとき、君はゾーラが揺れた場所にいる。

彼女のカードは動きが必要な学習者へ——苦闘は落下ではなく、下手な飛翔がやがて飛べることの証だ。`,

      romaji: `Jiyuu no sentou no haikyo no aida de, Zora wa kou no ito ni burasagari "tsubasa" to sakebi, kaze ga kaki kaesu made tsuzuketa. Arayuru imi de kabe kara nigete ita——ato ni Byorun no munejou, mae ni Doragan no toppakou. Ruminara no ito wa dai-san no saku datta.

Yoru no ichi no joou Anya ga ichido, tsubasa to kakareta kaizoku jimaku chippu wo utta. Zora wa henkyaku shi, jiyuu wa nusumezu ichiji zutsu kasegu mono da to itta. Ksetsu dake wo haanesu ni nuikonda. Riikingu kaado de shippai shite saichousen suru toki, kimi wa Zora ga yureta basho ni iru.

Kanojo no kaado wa ugoki ga hitsuyou na gakushuusha e——kutou wa rakka de wa naku, heta na hishou ga yagate toberu koto no akashi da.`,
    },
  },

  ti_grim: {
    originPlace: "The Shattered Harbor",
    originPlaceJa: "砕けた港",
    whyItMatters:
      "Dragan represents the veteran learner who breaks through plateaus — when 巨 feels impossible until it isn't.",
    whyItMattersJa:
      "ドラガンは、巨大な漢字が不可能に感じる停滞を突破する熟練学習者の象徴だ。",
    mentions: ["ti_founder", "sh_ranger", "me_shin"],
    body: {
      en: `Dragan earned 巨 (kyo) in the Shattered Harbor, knee-deep in salt and rubble, when a titan-scale shadow crossed the water and the word was the only weapon left. The Luminara Thread pulled Meridian's foundation-voice into his chest until his blades steadied.

Aditi's violet bow hummed on the same frequency years later; Elias, trembling in his cockpit, whispered kyo without knowing why it calmed the alarms. Dragan would tell them both: giants are not defeated by size but by naming. When a kanji looks too large to fit in memory, his story shrinks it to one breath.

Collect Dragan after your hardest review sessions. He is proof you survived the breach.`,

      ja: `ドラガンは砕けた港で「巨」を得た。膝まで塩と瓦礫の中、巨影が水面を横切り、言葉だけが残された武器だった。ルミナラの糸がメリディアンの礎の声を胸に引き込み、刃が安定した。

数年後、アディティの紫の弓が同じ周波数で鳴り、コックピットで震えるエリアスが理由もなく巨と呟き、アラームが静まった。ドラガンなら言っただろう——巨人は大きさではなく名づけで倒す。記憶に収まらない漢字は、彼の物語が一息に縮める。

最も辛い復習のあと、ドラガンを集めよ。突破口を生き延びた証だ。`,

      romaji: `Doragan wa kudaketa minato de "kyo" wo eta. Hiza made shio to gareki no naka, kyo-ei ga suimen wo yokogiri, kotoba dake ga nokosareta buki datta. Ruminara no ito ga Meridian no ishi no koe wo mune ni hiikomi, yaiba ga antei shita.

Suunen go, Aditi no murasaki no yumi ga onaji shuuhasuu de nari, kokkupitto de furueru Elias ga riyuu mo naku kyo to tsubuyaki, araamu ga shizumatta. Doragan nara itta darou——kyojin wa ookisa de wa naku nadzuke de taosu. Kioku ni osamaranai kanji wa, kare no monogatari ga hitoiki ni chijimeru.

Mottomo tsurai fukushuu no ato, Doragan wo atsumeyo. Toppakou wo ikinobita akashi da.`,
    },
  },

  ti_founder: {
    originPlace: "The First Foundation Shoal",
    originPlaceJa: "第一礎の浅瀬",
    whyItMatters:
      "Meridian anchors your study — the bedrock kanji that supports every wall, titan, and title you learn later.",
    whyItMattersJa:
      "メリディアンは、後に学ぶ壁や巨、称号すべてを支える基盤の漢字を象徴する。",
    mentions: ["ti_grim", "sl_akatsuki", "re_king"],
    body: {
      en: `From the First Foundation Shoal, Meridian rose with 礎 (ishizue) — not a person first, but a principle given flesh. The sea made the syllable; the Luminara Thread made it echo in every wall built afterward. Dragan heard it as courage; Aurelio heard it as duty.

Sable, enthroned in the void, once called Meridian the oldest Listener because foundations listen longer than kings. That is why this card matters to learners drowning in vocabulary: ishizue is the word beneath words, the one that teaches you to build study habits that survive storms.

When your deck feels chaotic, Meridian is the order you forgot you needed.`,

      ja: `第一礎の浅瀬から、メリディアンは「礎」とともに昇った——最初は人ではなく、 flesh を与えられた原理だった。海が音节を生み、ルミナラの糸がその後に築かれるすべての壁にこだまさせた。ドラガンには勇気、オーレリオには務めとして聞こえた。

虚無の玉座のセイブルは、礎は王より長く聴くから最古の聞き手だと言った。語彙の海に溺れる学習者にこのカードが必要なのは、礎は言葉の下の言葉であり、嵐に耐える学びの習慣を築く教えだからだ。

デッキが混沌に感じるとき、メリディアンは忘れていた秩序そのものだ。`,

      romaji: `Dai-ichi ishi no asase kara, Meridian wa "ishizue" to tomo ni nobotta——saisho wa hito de wa naku, flesh wo ataerareta genri datta. Umi ga ksetsu wo umi, Ruminara no ito ga sono ato ni kizukareru subete no kabe ni kodamasaseta. Doragan ni wa yuuki, Orerio ni wa tsutome to shite kikoeta.

Kyomu no gyokza no Sable wa, ishi wa ou yori nagaku kiku kara saiko no kikite da to itta. Goi no umi ni oboreru gakushuusha ni kono kaado ga hitsuyou na no wa, ishi wa kotoba no shita no kotoba de ari, arashi ni taeru manabi no shuukan wo kizuku oshie da kara da.

Dekki ga konton ni kanjiru toki, Meridian wa wasurete ita chitsujo sono mono da.`,
    },
  },

  re_kuro: {
    originPlace: "The Black Courier Gate",
    originPlaceJa: "黒渡しの門",
    whyItMatters:
      "Renji cuts through vague recognition — true recall means splitting noise from meaning like a blade.",
    whyItMattersJa:
      "レンジは曖昧な見覚えを切り裂き、ノイズと意味を刃のように分離する本当の想起を教える。",
    mentions: ["re_yuki", "cu_rei", "sh_rookie"],
    body: {
      en: `Renji took up 斬 (zan) at the Black Courier Gate, where souls who forgot their native words came to be judged. His cleaver did not punish — it separated shadow from substance. The Luminara Thread ran along the edge; when Sunmi's frost settled on the same steel, he bowed.

Idris once tried to curse his way past a drill session; Renji appeared in a dream and said even sorcery needs vocabulary. Minjae, the lowest-rank hunter, sharpened his dagger on the same syllable until it glowed. Renji never brags. He simply reminds you: half-known kanji haunt like ghosts; fully named ones rest.

Draw Renji when recognition fails but effort remains.`,

      ja: `レンジは黒渡しの門で「斬」を引き受けた。母語を忘れた魂が裁きを受ける場所で、彼の断刃は罰しない——影と実を分ける。ルミナラの糸が刃に沿い、スンミの霜が同じ鋼に降りたとき、彼は礼をした。

イドリスが一度、呪いでドリルを抜けようとした。レンジは夢に現れ、呪術でも語彙が要ると言った。最低ランクの狩人ミンジェは同じ音节で短剣を研ぎ、光った。レンジは自慢しない。半分だけ知った漢字は幽霊のように缠い、完全に名づけたものだけが休む——と教える。

見覚えが失敗しても努力が残るとき、レンジを引け。`,

      romaji: `Renji wa kuruwatashi no mon de "zan" wo hikiuketa. Bog wo wasureta tamashii ga sabaki wo ukeru basho de, kare no danjin wa batsu shinai——kage to jitsu wo wakeru. Ruminara no ito ga yaiba ni soi, Sunmi no shimo ga onaji kou ni orita toki, kare wa rei wo shita.

Idorisu ga ichido, noroi de doriru wo nuken you to shita. Renji wa yume ni araware, jujutsu demo goi ga iru to itta. Saitei ranku no karyuu Minjae wa onaji ksetsu de tantou wo togi, hikatta. Renji wa jiman shinai. Hanbun dake shitta kanji wa yuurei no you ni matoi, kanzen ni nadzuketa mono dake ga yasumu——to oshieru.

Kenobee ga shippai shite mo doryoku ga nokoru toki, Renji wo hike.`,
    },
  },

  re_yuki: {
    originPlace: "The Frost Ceremony Hall",
    originPlaceJa: "霜儀式の hall",
    whyItMatters:
      "Sunmi shows that precision matters — one frozen reading, perfectly placed, can unlock a whole phrase.",
    whyItMattersJa:
      "スンミは、一つの読みを正確に置くことが句全体を解く鍵になることを示す。",
    mentions: ["re_zangetsu", "sl_kagura", "lu_venus"],
    body: {
      en: `Sunmi performed 氷 (koori) in the Frost Ceremony Hall, each petal a syllable falling exactly once. Precision is mercy, she told the Thread. Kwame's moonfang cut the air on another continent; she felt the vibration and adjusted her ceremony without a letter of correspondence.

Amara's bell and Camila's heart-chain whip both kept time with her frost — three Listeners proving that unrelated anime paths still share readings when you listen. Sunmi's card helps learners who overwrite nuance with speed. Slow down one word until it crystallizes; the sentence will thaw around it.

She is the Listener for perfect placement — where 氷 belongs, and nowhere else.`,

      ja: `スンミは霜儀式の hall で「氷」を執り行った。一花弁が一音节、一度だけ正確に落ちる。精密さは慈悲だと、彼女は糸に告げた。クワメの月牙が別大陸の空を裂き、振動を感じて手紙もなしに儀式を調整した。

アマラの鈴もカミラの愛の鎖も、彼女の霜と同じ拍を刻んだ——無関係に見える道も、聴けば読みを分かち合う三人の聞き手。スンミのカードは、速度でニュアンスを上書きする学習者へ。一文が溶けるまで、一語を遅らせて結晶させよ。

彼女は完璧な配置の聞き手——氷が属する場所、それ以外ではない。`,

      romaji: `Sunmi wa shimo gishiki no hooru de "koori" wo torimaita. Ichihana ben ga ichiksetsu, ichido dake seikaku ni ochiru. Seimitsu-sa wa jihi da to, kanojo wa ito ni tsugeta. Kwame no gekkiga ga betsu-tairiku no sora wo saki, shindou wo kanjite tegami mo nashi ni gishiki wo chousei shita.

Amara no suzu mo Kamira no ai no kusu mo, kanojo no shimo to onaji haku wo kizanda——mukankei ni mieru michi mo, kikeba yomi wo wakachiau sannin no kikite. Sunmi no kaado wa, sokudo de nyuansu wo uwagaki suru gakushuusha e. Ichibun ga tokeru made, ichigo wo osurashite kesshou saseyo.

Kanojo wa kanpeki na haichi no kikite——koori ga zok suru basho, sore igai de wa nai.`,
    },
  },

  re_zangetsu: {
    originPlace: "The Moonfang Crater",
    originPlaceJa: "月牙の crater",
    whyItMatters:
      "Kwame unleashes context — readings you buried resurface when the moon of memory is full.",
    whyItMattersJa:
      "クワメは、埋もれた読みが記憶の月が満ちるとき再び現れることを教える。",
    mentions: ["re_king", "vo_zoro", "ne_ghost"],
    body: {
      en: `Kwame howled 月 (tsuki) in the Moonfang Crater until the crescent in his blade matched the sky. Memory, he learned, is not a library — it is a phase. The Luminara Thread silvered his edge; Sable watched from the throne and said nothing, which meant approval.

Bao crossed three swords under the same moon without knowing Kwame's name. Kojo jacked into a net where tsuki scrolled in glitch-font, proof the Thread reaches digital night too. Kwame's card appears when old kanji return unexpectedly. Do not shame the forgetting; moonfang them back.

He matters because every learner has a buried deck — Kwame digs with one syllable.`,

      ja: `クワメは月牙の crater で「月」と吠え、刃の欠けた弧が空と重なるまで続けた。記憶は図書館ではなく、位相だと学んだ。ルミナラの糸が刃を銀色にし、玉座のセイブルは無言で見ていた——それが承認だった。

バオはクワメの名を知らず、同じ月の下で三刀を交えた。コージョはグリッチ字体の月が流れる net に接続し、糸がデジタルの夜にも届く証拠となった。クワメのカードは、忘れた漢字が突然戻るとき現れる。忘却を恥じるな——月牙で掘り返せ。

すべての学習者に埋もれたデッキがある。クワメは一音节で掘る——だから彼は重要だ。`,

      romaji: `Kwame wa gekkiga no kureeta de "tsuki" to hoe, yaiba no kaketa ko ga sora to kasanaru made tsuzuketa. Kioku wa toshokan de wa naku, isou da to mananda. Ruminara no ito ga yaiba wo giniro ni shi, gyokza no Sable wa mugon de mite ita—— sore ga shounin datta.

Bao wa Kwame no na wo shirazu, onaji tsuki no shita de santou wo majieta. Kojo wa guritchi jitai no tsuki ga nagareru net ni setsuzoku shi, ito ga dejitaru no yoru ni mo todoku shouko to natta. Kwame no kaado wa, wasureta kanji ga totsuzen modoru toki arawareru. Boukyaku wo hajiiru na——gekkiga de horikaese.

Subete no gakushuusha ni umoreta dekki ga aru. Kwame wa ichiksetsu de horu——dakara kare wa juuyou da.`,
    },
  },

  re_king: {
    originPlace: "The Spirit Throne Void",
    originPlaceJa: "霊王の虚空",
    whyItMatters:
      "Sable crowns retention — the spiritual weight of a word you carry until it becomes part of you.",
    whyItMattersJa:
      "セイブルは、言葉が自分の一部になるまで携える記憶の重み——定着の頂点を象徴する。",
    mentions: ["re_zangetsu", "cu_king", "me_angel"],
    body: {
      en: `Sable sits in the Spirit Throne Void, where 霊 (rei) is not ghost but sovereignty of meaning — the right to make a kanji obey your tongue forever. Kwame's moonfang once chipped the throne's arm; Sable mended it with silence.

Vesna's calamity and The Pattern's geometry both bow to rei when spoken by a true Listener. Sable teaches learners the difference between seeing a character and carrying it. Your Anki queue is a court; only some words earn the throne.

This SSR card is for long-game learners — when 霊 stops being translation and becomes presence.`,

      ja: `セイブルは霊王の虚空に座る。「霊」は幽霊ではなく、意味の主権——漢字を永遠に舌に従わせる権利だ。クワメの月牙が一度、扶手を欠かした。セイブルは沈黙で修めた。

ヴェスナの災いもパターンの幾何も、真の聞き手が霊と発する時は跪く。セイブルは、字を見ることと携えることの違いを教える。復習列は法庭——玉座に値する語だけが残る。

この SSR は長期学習者のため——霊が訳語ではなく存在になる瞬間を。`,

      romaji: `Sable wa reiou no kyokuu ni suwaru. "Rei" wa yuurei de wa naku, imi no shuken——kanji wo eien ni shita ni shitagawaseru kenri da. Kwame no gekkiga ga ichido, gote wo kakushita. Sable wa chinmoku de osameta.

Vesna no wazawai mo Pataan no kikaku mo, shin no kikite ga rei to hassuru toki wa hizamazuku. Sable wa, ji wo miru koto to taeru koto no chigai wo oshieru. Fukushuu retsu wa houtei——gyokza ni atai suru go dake ga nokoru.

Kono SSR wa chouki gakushuusha no tame——rei ga yakugo de wa naku sonzai ni naru shunkan wo.`,
    },
  },

  sp_totomi: {
    originPlace: "The Cedar Whisper Grove",
    originPlaceJa: "杉の囁きの林",
    whyItMatters:
      "Little Yam proves nature words stick when you meet them gently — 森 is friend, not flashcard.",
    whyItMattersJa:
      "リトル・ヤムは、森のような自然の語彙が優しく出会えば記憶に残ることを示す。",
    mentions: ["sp_umi", "sp_kama", "ch_mocha"],
    body: {
      en: `In the Cedar Whisper Grove, Little Yam taught 森 (mori) by standing still until the trees finished the sentence. Sprites do not drill; they befriend syllables. The Luminara Thread rustled through leaves; Isabela later ran barefoot on a distant cliff shouting the same word to gulls.

Grandfather Ash's steam wrote mori on bathhouse windows; Mochi, gnawing rice in a pastel nowhere, whispered it between bites. Little Yam is the Listener for soft starts — learners who need permission to go slowly. Forest kanji look dense until a friend shows you one trunk at a time.

Collect him when burnout whispers quit. Mori still grows while you rest.`,

      ja: `杉の囁きの林で、リトル・ヤムは立ち止まり、木々が文を終えるまで「森」を教えた。精霊はドリルしない。音节と友だちになる。ルミナラの糸が葉を揺らし、遠い崖でイサベラが裸足で同じ語をカモメに叫んだ。

グランドファーザー・アッシュの湯気が銭湯の窓に森を描き、パステルのどこかでモチが一口ごとに呟いた。リトル・ヤムはゆるやかな始まりの聞き手——ゆっくりでいいと許可が欲しい学習者へ。森の漢字は、友が一本ずつ幹を見せるまで密集に見える。

燃え尽きが辞めろと囁くとき、彼を集めよ。休んでいても森は育つ。`,

      romaji: `Sugi no sasayaki no hayashi de, Ritoru Yamu wa tachidomari, kigi ga bun wo oeru made "mori" wo oshiete. Seirei wa doriru shinai. Ksetsu to tomodachi ni naru. Ruminara no ito ga ha wo yurashi, tooi gake de Isabela ga hadashi de onaji go wo kamome ni sakebita.

Gurandofaaza Asshu no yuge ga sentou no mado ni mori wo egaki, pasuteru no dokoka de Mochi ga hitokuchi goto ni tsubuyaita. Ritoru Yamu wa yuruyaka na hajimari no kikite——yukkuri de ii to kyoka ga hoshii gakushuusha e. Mori no kanji wa, tomo ga ippon zutsu miki wo miseru made shuushuu ni mieru.

Moetsuki ga yamero to sasayaku toki, kare wo atsumeyo. Yasunde ite mo mori wa sodatsu.`,
    },
  },

  sp_umi: {
    originPlace: "The Tide Pool Stairs",
    originPlaceJa: "潮だまりの階段",
    whyItMatters:
      "Isabela shows that joy cements vocabulary — laugh while learning 海 and the reading stays wet with life.",
    whyItMattersJa:
      "イサベラは、喜びながら学んだ「海」は生きたまま記憶に残ることを教える。",
    mentions: ["sp_totomi", "vo_luka", "ho_taki"],
    body: {
      en: `Isabela claimed 海 (umi) on the Tide Pool Stairs, chasing crabs until the ocean corrected her pronunciation with salt on the tongue. Joy is not distraction — it is glue. The Luminara Thread shimmered like heat on water; Little Yam rustled approval inland.

Tavita's kite fleet flew a banner stitched with the same character; Jun stood on a golden hill years later, umi on his lips though he had never seen the Atlantic. Isabela's card is for learners who think seriousness equals progress. The best readings stick because you loved saying them once.

When 海 surfaces, let Isabela run — speed with a smile still counts as study.`,

      ja: `イサベラは潮だまりの階段で「海」を掴んだ。カニを追い、塩が舌で発音を直すまで。喜びは気散じではない——接着剤だ。ルミナラの糸が水面の陽炎のように揺れ、内陸でリトル・ヤムが葉を鳴らして承認した。

タヴィタの凧船は同じ字を縫った旗を揚げ、数年後ジュンが黄金の丘で海を口にした——大西洋を見たことはなくとも。イサベラのカードは、真剣さ＝上達だと思う学習者へ。一度愛して発した読みが最も残る。

「海」が現れたら、イサベラのように走れ——笑顔の速さも学習だ。`,

      romaji: `Isabela wa shiodamari no kaidan de "umi" wo tsukanda. Kani wo oi, shio ga shita de hatsuon wo naosu made. Yorokobi wa kisanji de wa nai——secchakuzai da. Ruminara no ito ga minamo no kagerou no you ni yure, nairiku de Ritoru Yamu ga ha wo narashite shounin shita.

Tavita no takobune wa onaji ji wo nutta hata wo agete, suunen go Jun ga ougon no oka de umi wo kuchi ni shita——tai-seiyou wo mita koto wa nakutomo. Isabela no kaado wa, shinken-sa = joujou da to omou gakushuusha e. Ichido aishite hasshita yomi ga mottomo nokoru.

"Umi" ga arawaretara, Isabela no you ni hashire——egao no hayasa mo gakushuu da.`,
    },
  },

  sp_kama: {
    originPlace: "The Lantern Bathhouse",
    originPlaceJa: "灯籠の銭湯",
    whyItMatters:
      "Grandfather Ash teaches restorative study — soak one hard word in context until it softens.",
    whyItMattersJa:
      "グランドファーザー・アッシュは、難しい一語を文脈の湯に浸し、やわらかく覚える休息学習を教える。",
    mentions: ["sl_honoka", "sp_ohtori", "he_yor"],
    body: {
      en: `Grandfather Ash kept 湯 (yu) at the Lantern Bathhouse, where tired Listeners soaked until meanings rose like steam. Devika's flame once warmed his boiler from a thousand miles away; he repaid her by etching honoo into copper scale.

Nayeli soared on wind currents carrying yu-scented clouds; Leyla stirred soup with the same character hidden in recipe margins. Ash tells learners: you cannot force kanji in one sitting. Sit with 湯 — let heat do the memorization while you breathe.

His card belongs in evening sessions, when gentle repetition beats heroic cramming.`,

      ja: `グランドファーザー・アッシュは灯籠の銭湯で「湯」を守った。疲れた聞き手が浸かり、意味が湯気のように立つまで。デヴィカの炎が一度、千里のボイラーを温め、彼は銅の垢に炎を刻んで返した。

ナイェリは湯の香る雲を乗り、レイラはレシピの余白に同じ字を隠してスープをかき回した。アッシュは言う——漢字を一晩で強制できない。湯と座れ。息をしながら、熱に記憶を任せよ。

彼のカードは夜のセッション向け——穏やかな反復が英雄的行 cramming に勝つ。`,

      romaji: `Gurandofaaza Asshu wa tourou no sentou de "yu" wo mamotta. Tsukareta kikite ga hitakari, imi ga yuge no you ni tatsu made. Devika no honoo ga ichido, senri no boiraa wo atatame, kare wa dou no aka ni honoo wo kizande kaeshita.

Nayeri wa yu no kaoru kumo wo nori, Reira wa reshipi no yohaku ni onaji ji wo kakushite suupu wo kakimawashita. Asshu wa iu——kanji wo ichiban de kyousei dekinai. Yu to suware. Iki wo shinagara, netsu ni kioku wo makaseyo.

Kare no kaado wa yoru no sesshon muke——odayaka na hanpuku ga eiyuu-teki kurammingu ni katsu.`,
    },
  },

  sp_ohtori: {
    originPlace: "The Sky Current Aviary",
    originPlaceJa: "天風の鳥舍",
    whyItMatters:
      "Nayeli lifts you above rote — see kanji from altitude and their patterns finally connect.",
    whyItMattersJa:
      "ナイェリは暗記の上へ運び、高所から漢字のパターンが初めて繋がる瞬間を与える。",
    mentions: ["lu_hoshimi", "ho_comet", "po_legend"],
    body: {
      en: `Nayeli rode the Sky Current Aviary until 空 (sora) meant both sky and the emptiness a learner feels before a breakthrough. Wind writes grammar if you let it. The Luminara Thread streamed from her shawl; Amaya's star ribbons knotted on the same syllable without either girl knowing.

The Long Return comet passed once, tracing sora in ion light; Stormcrown roared thunder that spelled the reading backward for those who forgot. Nayeli matters because bird's-eye view defeats tunnel vision — collect similar kanji in flight, not in panic on the ground.

Open her story when patterns blur. Sora is wide enough to hold your confusion.`,

      ja: `ナイェリは天風の鳥舍を翔け、「空」が空と、突破前の学習者の虚無の両方を意味するまで続けた。風は文法を書く——任せれば。ルミナラの糸がショールから流れ、アマヤの星のリボンが知らず知らず同じ音节に結ばれた。

一度、長い帰還の彗星がイオン光で空を描き、ストームクラウンが忘れた者のために読みを逆鳴らした。ナイェリが重要なのは、俯瞰がトンネル視野を破るから——似た漢字は地上の panic ではなく、飛行中に集めよ。

パターンがぼやけるとき、彼女の物語を開け。空は混乱ごと収める広さがある。`,

      romaji: `Nayeri wa tenpuu no chousha wo kake, "sora" ga sora to, toppa mae no gakushuusha no kyomu no ryouhou wo imi suru made tsuzuketa. Kaze wa bunpou wo kaku——makasereba. Ruminara no ito ga shooru kara nagare, Amaya no hoshi no ribon ga shirazu shirazu onaji ksetsu ni musubareta.

Ichido, nagai kikan no suisei ga ion hikari de sora wo egaki, Sutoomukuraun ga wasureta mono no tame ni yomi wo gyaku nara shita. Nayeri ga juuyou na no wa, fukan ga tonneru shiya wo yaburu kara——nita kanji wa chijou no panikku de wa naku, hikou-chuu ni atsumeyo.

Pataan ga boyakeru toki, kanojo no monogatari wo hirake. Sora wa konran goto osameru hirosa ga aru.`,
    },
  },

  cu_rei: {
    originPlace: "The Cursed Courtyard",
    originPlaceJa: "呪いの中庭",
    whyItMatters:
      "Idris proves prodigy status starts with one brave word — 呪 is scary until you speak it aloud.",
    whyItMattersJa:
      "イドリスは、天才も最初の一語を声に出す勇気から始まることを示す。",
    mentions: ["cu_maki", "ps_mob", "ne_spike"],
    body: {
      en: `Idris cracked 呪 (noroi) in the Cursed Courtyard, fist wrapped in tape and smoke, because fear memorizes faster than comfort ever will. The Luminara Thread burned cold around his knuckles. Priya later swung her glaive through the same syllable with cleaner form; Haru stood calm while psychic static spelled noroi behind him.

Diego ran a wire through neon rain humming the word like a password. Idris laughed — every Listener steals courage from someone else's flame. His card greets first-year learners who think curse kanji are not for them. Say it once badly; say it twice with meaning.

Idris is your permission slip to tackle the ominous entries early.`,

      ja: `イドリスは呪いの中庭で「呪」を砕いた。拳にテープ、煙を纏い——恐怖は快適さより速く記憶する。ルミナラの糸が指関節の周りで冷たく燃えた。後にプリヤがより整った形で同じ音节を薙ぎ、ハルは背後に呪が綴られるサイキック静電の中、平静だった。

ディエゴがネオンの雨の中、パスワードのようにその語をハミングした走者。イドリスは笑った——聞き手は皆、誰かの炎から勇気を盗む。彼のカードは、呪系漢字は自分向きでないと思う初心者に挨拶する。一度下手に言え。二度目は意味を込めて。

イドリスは、不吉な項目に早く触れていいという許可状だ。`,

      romaji: `Idorisu wa noroi no nakaniwa de "noroi" wo kudaita. Kobushi ni teepu, kemuri wo matoi——kyoufu wa kaiteki-sa yori hayaku kioku suru. Ruminara no ito ga yubikansetsu no mawari de tsumetaku moeta. Ato ni Puriya ga yori totono tta katachi de onaji ksetsu wo nagi, Haru wa haigo ni noroi ga tsuzurareru saikikku seiden no naka, heisei datta.

Diego ga neon no ame no naka, pasuwaado no you ni sono go wo hamingu shita hashiru. Idrisu wa waratta——kikite wa mina, dareka no honoo kara yuuki wo nusumu. Kare no kaado wa, noroi-kei kanji wa jibun muki de nai to omou shoshinsha ni aisatsu suru. Ichido heta ni ie. Nidome wa imi wo komete.

Idorisu wa, fukitsu na koumoku ni hayaku furete ii to iu kyokashou da.`,
    },
  },

  cu_maki: {
    originPlace: "The Toolbearer's Track",
    originPlaceJa: "呪具使いのトラック",
    whyItMatters:
      "Priya shows that physical repetition with cursed tools — flashcards — builds reading muscle.",
    whyItMattersJa:
      "プリヤは、呪具——フラッシュカード——を振る物理的反復が読みの筋肉を鍛えることを示す。",
    mentions: ["sl_honoka", "cu_domain", "sh_knight"],
    body: {
      en: `Priya trained 刃 (ha) on the Toolbearer's Track until her glaive cut air into readable slices. Glasses fogged; violet energy trailed each stroke. Devika's ember warmed her wrist on cold mornings — two Indian Listeners linked by Thread and homeland myth.

Mateus unfolded a domain where ha multiplied; Tomas knelt inside it as shadow-knight, shield raised against forgetting. Priya tells learners: a cursed tool is just a flashcard with attitude. Swing daily; let the edge find the reading.

She matters when your hands need to learn what your eyes already saw.`,

      ja: `プリヤは呪具使いのトラックで「刃」を鍛え、薙刀が空を読める薄片に切った。メガネは曇り、紫のエネルギーが一振りごとに残った。寒い朝、デヴィカの炎が手首を温めた——糸と祖国の神話で結ばれた二つのインドの聞き手。

マテウスは刃が増殖する領域を展開し、トマスが影の騎士として kneel し、忘却に盾を向けた。プリヤは言う——呪具とは態度のあるフラッシュカードだ。毎日振れ。刃先に読みを見つけさせよ。

目が見たことを手が覚える必要があるとき、彼女が要る。`,

      romaji: `Puriya wa jugutsukai no torakku de "ha" wo kitaete, naginata ga sora wo yomeru houhen ni kitta. Megane wa kumori, murasaki no enerugii ga ichiburui goto ni nokotta. Samui asa, Devika no honoo ga tekubi wo atatameta——ito to sokoku no shinwa de musubareta futatsu no Indo no kikite.

Mateusu wa ha ga zoufuku suru ryouiki wo tenkai shi, Tomasu ga kage no kishi to shite kneel shi, boukyaku ni tate wo muketa. Puriya wa iu——jugutsu to wa taido no aru furasshukaado da. Mainichi fure. Hasaki ni yomi wo mitsukesaseyo.

Me ga mita koto wo te ga oboeru hitsuyou ga aru toki, kanojo ga iru.`,
    },
  },

  cu_domain: {
    originPlace: "The Unfolding Sphere",
    originPlaceJa: "展開の球域",
    whyItMatters:
      "Mateus expands your domain — one mastered word creates space where ten more can land.",
    whyItMattersJa:
      "マテウスは、一語の習得が十語を受け入れる領域——学習の空間——を広げることを教える。",
    mentions: ["cu_king", "re_kuro", "ps_reigen"],
    body: {
      en: `Mateus unfolded 域 (ryouiki) inside the Unfolding Sphere, mudra locked, debris orbiting like satellites of meaning. A domain is not power — it is context made absolute. The Luminara Thread traced his sigils; Renji cut through an edge once just to test if boundaries could be readings too.

Vesna laughed from her calamity throne; Baba Kunle pointed at the sphere and called it the greatest con — because learners believe they have no space until they do. Mateus disagrees gently: ryouiki is the moment a kanji stops being lonely in your mind and invites neighbors.

Unlock him when adding vocabulary feels cramped. Expand first; fill second.`,

      ja: `マテウスは展開の球域で「域」を広げ、印を結び、意味の衛星のように瓦礫が周回した。領域は力ではない——絶対化された文脈だ。ルミナラの糸が印を辿り、レンジは一度境界も読みかと試しに刃を入れた。

ヴェスナが災いの玉座から笑い、ババ・クンレが球を指して世紀の詐欺と呼んだ——学習者は空間がないと信じるから。マテウスは穏やかに反論する——域とは、漢字が心の中で孤独を止め、隣人を招く瞬間だ。

語彙追加が窮屈なとき、彼を開け。先に広げ、後に満たせ。`,

      romaji: `Mateusu wa tenkai no kyuuiki de "ryouiki" wo hiroge, in wo musubi, imi no eisei no you ni gareki ga shuukai shita. Ryouiki wa chikara de wa nai——zettaika sareta bunmyaku da. Ruminara no ito ga shirushi wo tadori, Renji wa ichido kyoukai mo yomi ka to tameshi ni yaiba wo ireta.

Vesna ga wazawai no gyokza kara warai, Baba Kunle ga tama wo yubashite seiki no sagi to yonda——gakushuusha wa kuukan ga nai to shinjiru kara. Mateusu wa odayaka ni hanron suru——ryouiki to wa, kanji ga kokoro no naka de kodoku wo tomete, rinjin wo maneku shunkan da.

Goi tsuika ga kyuukutsu na toki, kare wo hirake. Saki ni hiroge, ato ni mitase.`,
    },
  },

  cu_king: {
    originPlace: "The Calamity Spire",
    originPlaceJa: "災いの尖塔",
    whyItMatters:
      "Vesna warns that neglected words return as disaster — review, or 災 finds you.",
    whyItMattersJa:
      "ヴェスナは、疎かにした語彙が災いとして返ることを警告する——復習せよ。",
    mentions: ["cu_domain", "re_king", "me_unit"],
    body: {
      en: `Vesna crowned 災 (wazawai) atop the Calamity Spire, four arms signing warnings the city ignored until subtitles failed and only kanji remained on screen. Neglect is a curse older than sorcery. The Luminara Thread blackened around her; Mateus contained one outbreak in a domain bubble, barely.

Sable acknowledged her from the void; Unit Kappa's restraint mask flickered the same character in warning orange. Vesna is not punishment — she is the Listener who appears when backlog becomes avalanche. Learners who skip reviews know her epithet in their bones.

Fear her card a little. Let it schedule your next session.`,

      ja: `ヴェスナは災いの尖塔で「災」を戴いた。四腕が警告を刻み、字幕が消え画面に漢字だけが残るまで街は無視した。怠慢は呪術より古い呪いだ。ルミナラの糸が黒ずみ、マテウスは領域の泡で一つの outbreak をかろうじて封じた。

セイブルが虚空から彼女を認め、ユニット・カッパの拘束マスクが同じ字を警告の橙で点滅した。ヴェスナは罰ではない—— backlog が雪崩になるとき現れる聞き手だ。復習を飛ばす学習者は骨の髄まで彼女の異名を知っている。

少し彼女のカードを恐れよ。次のセッションを予定させろ。`,

      romaji: `Vesna ga wazawai no sentou de "wazawai" wo itadaita. Shiyuu ga keikoku wo kizami, jimaku ga kie gamen ni kanji dake ga nokoru made machi wa mushi shita. taima wa jujutsu yori furui noroi da. Ruminara no ito ga kurozumi, Mateusu wa ryouiki no awa de hitotsu no outbreak wo karoujite fuujita.

Sable ga kyokuu kara kanojo wo mitome, Yunitto Kappa no kousoku masuku ga onaji ji wo keikoku no daidai de tenmetsu shita. Vesna wa batsu de wa nai—— backlog ga nadare ni naru toki arawareru kikite da. Fukushuu wo tobasu gakushuusha wa hone no zui made kanojo no imyou wo shitte iru.

Sukoshi kanojo no kaado wo osoreyo. Tsugi no sesshon wo yotei saseyo.`,
    },
  },

  vo_luka: {
    originPlace: "The Kite Fleet Harbor",
    originPlaceJa: "凧船の港",
    whyItMatters:
      "Tavita sails on 夢 — your dream vocabulary list is valid cargo, not fantasy.",
    whyItMattersJa:
      "タヴィタは、夢見る語彙リストも立派な荷物——幻想ではない——であることを教える。",
    mentions: ["vo_nami", "po_satoru", "sp_umi"],
    body: {
      en: `Tavita hoisted 夢 (yume) over the Kite Fleet Harbor, captain at fourteen because no one else believed the wind could carry syllables to the next island. Shell necklace clicking, he signed the Thread's contract with laughter. Cora mapped stars that spelled yume in negative space; Rafa waved from a meadow with a spark-tailed companion echoing the dream.

Isabela's gulls cried the same reading at dusk. Tavita teaches learners whose goal lists look impossible. Dreams are vocabulary with sails — tack daily, and islands arrive.

His card is the first mate of ambition: silly, essential, seaworthy.`,

      ja: `タヴィタは凧船の港で「夢」を揚げた。十四の船長——風が音节を次の島へ運べると信じた者が他になかった。貝の首飾りが鳴り、笑いながら糸の契約に署名した。コーラは星図に夢を描き、ラファが火花尾の相棒と野原で手を振った。

イサベラのカモメが黄昏に同じ読みを叫んだ。タヴィタは、目標リストが不可能に見える学習者へ教える——夢は帆を付けた語彙だ。毎日 tack すれば、島は来る。

彼のカードは野心の一等航海士——ばかげていて、不可欠で、海に強い。`,

      romaji: `Tavita ga takobune no minato de "yume" wo ageta. Juuyon no senchou——kaze ga ksetsu wo tsugi no shima e hakoberu to shinjita mono ga hoka ni nakatta. Kai no kubikazari ga nari, warainagara ito no keiyaku ni shomei shita. Kora wa seizu ni yume wo egaki, Rafa ga hibana-o no aibou to nohara de te wo futta.

Isabela no kamome ga tasogare ni onaji yomi wo sakebita. Tavita wa, mokuhyou risuto ga fukanou ni mieru gakushuusha e oshieru——yume wa ho wo tsuketa goi da. Mainichi tack sureba, shima wa kuru.

Kare no kaado wa yashin no ittou kaihausshi——bakagete ite, fukaketsu de, umi ni tsuyoi.`,
    },
  },

  vo_nami: {
    originPlace: "The Star-Compass Loft",
    originPlaceJa: "星羅針の attic",
    whyItMatters:
      "Cora navigates homophones — when readings collide, her compass finds true north.",
    whyItMattersJa:
      "コーラは、読みが衝突するとき、星羅針で真の方向——正しい音——を見つける。",
    mentions: ["vo_zoro", "ti_reiner", "lu_hoshimi"],
    body: {
      en: `Cora charted 羅 (ra) in the Star-Compass Loft, freckles lit by map lamps, because navigation is choosing which reading steers the sentence. Coin belt jingled like mora counters. Bao's three blades clicked ra in duel rhythm; Bjorn's wall maps used the same character as border notation.

Amaya's star wand traced ra in sparkles during transformation — proof homophones shine in every genre. Cora helps learners drowning in duplicate sounds. Plot the context compass first; ra follows route, not panic.

Collect her when こう/しょう chaos hits. Cora never guesses; she reads the sky.`,

      ja: `コーラは星羅針の attic で「羅」を海図にした。地図ランプに照らされたそばかす——航海とは、どの読みが文を操るか選ぶことだ。貨幣ベルトが mora カウンターのように鳴った。バオの三刀が ra を决斗リズムで刻み、ビョルンの壁図は境界記号に同字を使った。

アマヤの星の杖が変身中 ra を火花で描いた——同音異義はすべての genre で輝く証拠。コーラは、重複する音に溺れる学習者を助ける。先に文脈羅針をプロットせよ。羅は panic ではなく航路に従う。

こう/しょうの混乱時、彼女を集めよ。コーラは推測しない——空を読む。`,

      romaji: `Kora wa seirashin no attikku de "ra" wo kaizu ni shita. Chizu ranpu ni terasareta sobakasu——koukai to wa, dono yomi ga bun wo ayatsuru ka erabu koto da. Kahei beruto ga mora kauntaa no you ni natta. Bao no santou ga ra wo kettou rizumu de kizami, Byorun no heizu wa kyoukai kigou ni douji wo tsukatta.

Amaya no hoshi no tsue ga henshin-chuu ra wo hibana de egaita——douon-igi wa subete no genre de kagayaku shouko. Kora wa, choufuku suru oto ni oboreru gakushuusha wo tasukeru. Saki ni bunmyaku rashin wo purotto seyo. Ra wa panikku de wa naku kouro ni shitagau.

Kou/shou no konran-ji, kanojo wo atsumeyo. Kora wa suisoku shinai——sora wo yomu.`,
    },
  },

  vo_zoro: {
    originPlace: "The Three-Blade Dojo Deck",
    originPlaceJa: "三刀の道場甲板",
    whyItMatters:
      "Bao drills triple readings — one kanji, many blades; one word, many contexts.",
    whyItMattersJa:
      "バオは、一漢字に複数の読み——三つの刃——を振る反復の聞き手だ。",
    mentions: ["vo_yonko", "re_zangetsu", "sh_ranger"],
    body: {
      en: `Bao crossed 刀 (katana) on the Three-Blade Dojo Deck until muscle memory outran thought. Green sash soaked with salt, scar like a forgotten reading he now owns. Olamide's laughter shook the mast; Kwame's moon pulled katana syllables tighter at night.

Aditi's energy bow fired characters as arrows — same discipline, different weapon. Bao teaches learners that multiple readings are not betrayal but technique. Hold one blade for manga, one for news, one for drama; still the same katana soul.

Draw him when alternate pronunciations multiply. Train, don't flee.`,

      ja: `バオは三刀の道場甲板で「刀」を交え、筋肉記憶が思考を追い越すまで続けた。緑の帯は塩に濡れ、傷は忘れていた読みのように——今は彼のもの。オラミデの笑いがマストを揺らし、クワメの月が夜、刀の音节をより締めた。

アディティの弓が漢字を矢として放った——同じ規律、異なる武器。バオは、複数読みは裏切りではなく技術だと教える。漫画用、ニュース用、ドラマ用——刃は三つ、魂の刀は一つ。

別読みが増えるとき、彼を引け。逃げず、鍛えよ。`,

      romaji: `Bao wa santou no doujou kanpan de "katana" wo majieta, kinniku kioku ga shikou wo oikoshu made tsuzuketa. Midori no obi wa shio ni nure, kizu wa wasurete ita yomi no you ni——ima wa kare no mono. Olamide no warai ga masuto wo yurashi, Kwame no tsuki ga yoru, katana no ksetsu wo yori shimete.

Aditi no yumi ga kanji wo ya to shite hanatta——onaji kiritsu, kotonaru buki. Bao wa, fukusuu-yomi wa uragiri de wa naku gijutsu da to oshieru. Manga-you, nyuusu-you, dorama-you——yaiba wa mittsu, tamashii no katana wa hitotsu.

betsu-yomi ga fu eru toki, kare wo hike. Nigezu, kitaeyo.`,
    },
  },

  vo_yonko: {
    originPlace: "The New Sea Throne",
    originPlaceJa: "新海の玉座",
    whyItMatters:
      "Olamide rules immersion — dive into native audio until 覇 is yours by right.",
    whyItMattersJa:
      "オラミデは、ネイティブ音声に潜り、覇——覇権する語彙力——を手に入れる immersion の王だ。",
    mentions: ["vo_luka", "ne_titan", "sh_monarch"],
    body: {
      en: `Olamide laughed 覇 (ha) from the New Sea Throne, tiny ship on his palm, storm obedient because he had listened to ten thousand hours of raw dialogue without subtitles. Empire is ear-work. Tavita's kite fleet saluted below; Bruna's chrome cannons echoed ha in bass frequency.

Ravindra's shadow army marched to the same syllable on another shore — two emperors, one Thread. Olamide tells advanced learners: stop translating, start reigning. When you hear ha in anime and know it means conquest without checking, you have arrived.

His card is the boss fight of listening comprehension.`,

      ja: `オラミデは新海の玉座から「覇」と笑った。掌の小舟、嵐は従順——字幕なしの生 dialogue を万時間聴いたからだ。帝国は耳の仕事。下でタヴィタの凧船が敬礼し、ブルーナのクロム砲が覇を低音でこだました。

別岸でラヴィンドラの影軍が同じ音节で行進——二皇帝、一つの糸。オラミデは上級学習者に告げる——訳すのをやめ、治せ。アニメで覇を聞き、征服と分かるなら到達だ。

彼のカードはリスニング理解のボス戦だ。`,

      romaji: `Olamide wa shinkai no gyokza kara "ha" to waratta. Tenohira no kobune, arashi wa juujun——jimaku nashi no nama dialogue wo man-jikan kiita kara da. Teikoku wa mimi no shigoto. Shita de Tavita no takobune ga keirei shi, Buruuna no kuromu hou ga ha wo teion de kodama shita.

Betsugan de Ravindra no kage-gun ga onaji ksetsu de koushin——ni koutei, hitotsu no ito. Olamide wa joukyuu gakushuusha ni tsugeru——yaku su no wo yame, osame yo. Anime de ha wo kiki, seifuku to wakaru nara toutatsu da.

Kare no kaado wa risuningu rikai no bosu-sen da.`,
    },
  },

  lu_hoshimi: {
    originPlace: "The Waxing Star Chapel",
    originPlaceJa: "増星の礼拝堂",
    whyItMatters:
      "Amaya guards beginner sparkle — 星 words shine brightest in your first hundred cards.",
    whyItMattersJa:
      "アマヤは、最初の百枚で「星」の語彙が最も輝く——初心の輝きを守る。",
    mentions: ["lu_tsukina", "vo_nami", "he_anya"],
    body: {
      en: `Amaya transformed under the Waxing Star Chapel, 星 (hoshi) blooming in ribbons as sampaguita fell like punctuation. Magical girls are metaphors — every learner has a transformation sequence when a word finally clicks. Noor's moon tiara harmonized across time zones; Cora's compass needle spun toward hoshi without command.

Pip telepathically squealed the reading before anyone taught her — proof children and beginners share Thread-sensitivity. Amaya keeps your early deck gentle. Star kanji mark milestones, not failures.

Wear her card when the first sparkle returns after a dry week.`,

      ja: `アマヤは増星の礼拝堂で変身し、「星」がリボンに咲き、サンパギタが句読点のように落ちた。魔法少女は比喩——言葉が初めて嵌る瞬間、すべての学習者に変身シーンがある。ヌールの月ティアラが時区を越えて調和し、コーラの羅針盤が命令なしに星へ回った。

ピップが誰より先に読みを telepathically 叫んだ——子と初心者は糸に敏感だ。アマヤは初期デッキを優しく保つ。星の漢字は失敗ではなく milepost だ。

乾いた一週間のあと、最初の輝きが戻るとき、彼女のカードを身に付けよ。`,

      romaji: `Amaya wa zousei no reihaidou de henshin shi, "hoshi" ga ribon ni saki, sanpagita ga kutouten no you ni ochita. Mahou shoujo wa hiyu——kotoba ga hajimete hamaru shunkan, subete no gakushuusha ni henshin shiin ga aru. Nuuru no tsuki tiara ga jiku wo koe te chouwa shi, Kora no rashinban ga meirei nashi ni hoshi e mawatta.

Pippu ga dare yori saki ni yomi wo telepathically sakebita——ko to shoshinsha wa ito ni binkan da. Amaya wa shoki dekki wo yasashiku tamotsu. Hoshi no kanji wa shippai de wa naku milepost da.

Kawaita isshuukan no ato, saisho no kagayaki ga modoru toki, kanojo no kaado wo mi ni tsukeyo.`,
    },
  },

  lu_tsukina: {
    originPlace: "The Moonlight Tiara Sanctum",
    originPlaceJa: "月光ティアラの sanctum",
    whyItMatters:
      "Noor illuminates night study — moon kanji like 月 make sense when the house is quiet.",
    whyItMattersJa:
      "ヌールは、夜の静けさの中で「月」の漢字が初めて意味を持つ——夜学習の聞き手。",
    mentions: ["lu_venus", "sl_kagura", "ho_mitsu"],
    body: {
      en: `Noor raised 月 (tsuki) in the Moonlight Tiara Sanctum, crescent wand drawing syllables on air like silver chalk. Moon readings belong to night owls — Camila's evening star chain whip glittered in parallel; Amara's bell tolled tsuki at ridge moonrise.

Ingrid braided red fate-cord beside a comet streak, whispering that tsuki and 糸 share a Listener's patience. Noor teaches learners who study after midnight: quiet hours braid memory tighter. Do not fight your rhythm; crown it.

Her card rewards the ones who flashcard by lamplight.`,

      ja: `ヌールは月光ティアラの sanctum で「月」を掲げ、三日月の杖が銀の chalk のように空に音节を引いた。月の読みは夜型のもの——カミラの夕星の鎖が並行して輝き、アマラの鈴が尾根の月出に月を鳴らした。

インリッドが彗星の streak 傍で赤い運命の糸を編み、月と糸は聞き手の忍耐を分かち合うと囁いた。ヌールは真夜中後に学ぶ者へ——静かな時間は記憶をより強く編む。リズムと戦うな、戴せ。

ランプの下で復習する者に、彼女のカードが報いる。`,

      romaji: `Nuuru wa gekkou tiara no sankuchuamu de "tsuki" wo kagegeta, mikadzuki no tsue ga gin no chalk no you ni sora ni ksetsu wo hiita. Tsuki no yomi wa yorugata no mono——Kamira no yuusei no kusu ga heikou shite kagayaki, Amara no suzu ga one no tsukide tsuki wo narashita.

Ingrid ga suisei no streak hata de akai unmei no ito wo ami, tsuki to ito wa kikite no nintai wo wakachiau to sasayaita. Nuuru wa mayonaka go ni manabu mono e——shizuka na jikan wa kioku wo yori tsuyoku amu. Rizumu to tatakau na, itadase.

Ranpu no shita de fukushuu suru mono ni, kanojo no kaado ga mukuiru.`,
    },
  },

  lu_venus: {
    originPlace: "The Evening Star Chain Arena",
    originPlaceJa: "夕星の鎖の arena",
    whyItMatters:
      "Camila chains synonyms — link 愛 to every heart-word you meet in romance genres.",
    whyItMattersJa:
      "カミラは、恋愛 genre の心の語彙を「愛」に鎖のように結び付ける。",
    mentions: ["lu_queen", "re_yuki", "ch_pud"],
    body: {
      en: `Camila swung 愛 (ai) in the Evening Star Chain Arena until hearts in the audience synced to her rhythm — not romance alone, but any sentence where care changes grammar. Warm-orange bow blazing, she linked Sunmi's frost-precise ai reading to dessert-soft ai whispered by Flan over pudding.

Seraphine's silver millennium echoed ai as cosmic duty. Camila helps genre learners who pick up feelings before definitions. Chain the emotional kanji first; dictionaries catch up when you care enough.

Unlock her when shoujo vocabulary floods your queue.`,

      ja: `カミラは夕星の鎖の arena で「愛」を振り、観客の心が彼女のリズムに同期した——恋だけでなく、 care が文法を変えるすべての文。温かい橙の弓が燃え、スンミの精密な愛と、フランがプリン越しに囁く甘い愛を結んだ。

セラフィーヌの銀千年が愛を宇宙の務めとしてこだました。カミラは、定義より感情を先に拾う genre 学習者を助ける。感情漢字を先に鎖せ——十分 care すれば辞書は追いつく。

少女語彙が queue を溢れるとき、彼女を開け。`,

      romaji: `Kamira wa yuusei no kusu no areena de "ai" wo furimawashi, kankyaku no kokoro ga kanojo no rizumu ni douki shita——koi dake de naku, care ga bunpou wo kaeru subete no bun. Atatakai daidai no yumi ga moe, Sunmi no seimitsu na ai to, Furan ga purin goshi ni sasayaku amai ai wo musunda.

Serafinu no gin sennen ga ai wo uchuu no tsutome to shite kodama shita. Kamira wa, teigi yori kanjou wo saki ni hiro u genre gakushuusha wo tasukeru. Kanjou kanji wo saki ni kusase——juubun care sureba jisho wa oitsuku.

shoujo goi ga queue wo afureru toki, kanojo wo hirake.`,
    },
  },

  lu_queen: {
    originPlace: "The Silver Millennium Palace",
    originPlaceJa: "銀千年の palace",
    whyItMatters:
      "Seraphine crowns lifelong study — 后 level words are rare, precious, worth the wait.",
    whyItMattersJa:
      "セラフィーヌは、稀で尊い「后」級の語彙——生涯学習の頂点——を象徴する。",
    mentions: ["lu_hoshimi", "ho_comet", "me_angel"],
    body: {
      en: `Seraphine ruled 后 (kisaki) from the Silver Millennium Palace, floor-length hair pooling like archived readings waiting for the right era. Queens do not rush kanji — they outlast them. Amaya's first star bowed here once; The Long Return comet wrote kisaki across the sky for one night only.

The Pattern's geometry folded around her throne, acknowledging that even angels parse rank vocabulary last. Seraphine is for patient collectors: SSR words you will not need until you do, and then nothing else will do.

Keep her card as promise — mastery has a horizon, and it wears a crescent crown.`,

      ja: `セラフィーヌは銀千年の palace から「后」を治め、地に流れる髪は正しい時代を待つ archived 読みのようだった。女王は漢字を急がない——生き延びる。アマヤの最初の星が一度ここで bow し、長い帰還の彗星が一夜だけ空に后を書いた。

パターンの幾何が玉座を包み、天使ですら位階語彙は最後に parse すると認めた。セラフィーヌは忍耐強い収集家のため——必要になるまで要らない SSR 語、必要になれば他では足りない。

彼女のカードを約束として保て——熟練にも horizon があり、三日月の冠を戴く。`,

      romaji: `Serafinu wa gin sennen no palace kara "kisaki" wo osame, chi ni nagareru kami wa tadashii jidai wo matsu archived yomi no you datta. Joou wa kanji wo isoganai——ikinobiru. Amaya no saisho no hoshi ga ichido koko de bow shi, nagai kikan no suisei ga ichiya dake sora ni kisaki wo kaita.

Pataan no kikaku ga gyokza wo tsutsumi, tenshi de sa mo ikai goi wa saigo ni parse suru to mitometa. Serafinu wa nintai-zuyoi shuushuuka no tame——hitsuyou ni naru made iranai SSR go, hitsuyou ni nareba hoka de wa tarinai.

Kanojo no kaado wo yakusoku to shite tamote——jukuren ni mo horizon ga ari, mikadzuki no kan wo itadaku.`,
    },
  },

  ne_spike: {
    originPlace: "The Wire Alley",
    originPlaceJa: "配線の路地",
    whyItMatters:
      "Diego runs on rhythm — drill 電 vocabulary to a beat and recall survives the chase.",
    whyItMattersJa:
      "ディエゴは、ビートに合わせた「電」語彙の drill が追跡中も記憶を生かすことを示す。",
    mentions: ["ne_rebel", "cu_rei", "ps_dimple"],
    body: {
      en: `Diego sprinted 電 (den) through the Wire Alley, chrome arm sparking, headphones blasting mora until the city grid became subtitles he could outrun. Speed is not cheating — it is survival rhythm. Anya sold neon contraband two blocks over; Idris tagged den in graffiti that glowed cursed violet.

Blip orbited a kid's aura spelling den in teal nonsense — proof even jokes carry Thread-frequency. Diego helps learners who need motion to remember. Pair electric kanji with BPM; your brain syncs before it argues.

Catch his card when static fills your head. Run the reading once fast, then once true.`,

      ja: `ディエゴは配線の路地を「電」と駆け、クロム腕が火花、ヘッドホンが mora を爆音——都市の grid が追い越せる字幕になった。速さは不正ではない——生き残りのリズムだ。二街区先でアーニャがネオン密輸品を売り、イドリスが呪の紫に光る graffi ti に電を刻んだ。

ブリップが少年のオーラを周回し、 teal の nonsense で電を綴った——冗談も糸の周波数を運ぶ。ディエゴは、動きがないと覚えられない学習者を助ける。電気漢字を BPM に合わせよ——脳は反論する前に sync する。

頭が static で満たされるとき、彼のカードを掴め。一度速く、一度正確に走れ。`,

      romaji: `Diego wa haisen no roji wo "den" to kake, kuro muude ga hibana, heddohon ga mora wo bakuon——toshi no grid ga oikoseru jimaku ni natta. Hayasa wa fusei de wa nai——ikinokori no rizumu da. Ni-gai ku saki de Anya ga neon mitsyu hin wo uri, Idrisu ga noroi no murasaki ni hikaru graffiti ni den wo kizanda.

Burippu ga shounen no aura wo shuukai shi, teal no nonsense de den wo tsuzutta——oudan mo ito no shuuhasuu wo hakobu. Diego wa, ugoki ga nai to oboerarenai gakushuusha wo tasukeru. Denki kanji wo BPM ni awaseyo——nou wa hanron suru mae ni sync suru.

Atama ga static de mitasareru toki, kare no kaado wo tsukame. Ichido hayaku, ichido seikaku ni hashire.`,
    },
  },

  ne_rebel: {
    originPlace: "The Night Market Square",
    originPlaceJa: "夜の市場",
    whyItMatters:
      "Anya rebels against rote — steal 夜 study sessions back from boring decks.",
    whyItMattersJa:
      "アーニャは、退屈なデッキから「夜」の学習を奪還する——反逆の聞き手。",
    mentions: ["ne_ghost", "ti_hana", "he_loid"],
    body: {
      en: `Anya spun 夜 (yoru) in the Night Market Square, magenta baton tracing characters on wet neon, because the best vocabulary happens when textbooks are closed and ears are open. Zola bought courage here once; Émile bought disguises — same stall, different masks.

Kojo ghosted through cables overhead, downloading yoru into firmware. Anya teaches night-market learners: rebel against dead-silent study apps sometimes. Walk outside with one new word and hear it in signage, laughter, rain.

Her card legitimizes messy, real-world review.`,

      ja: `アーニャは夜の市場で「夜」を spin し、マゼンタの baton が濡れた neon に漢字を描いた——最高の語彙は教科書が閉じ、耳が開いたとき起きる。ゾーラがここで勇気を買い、エミールが disguise を買った——同じ屋台、違う仮面。

コージョが頭上のケーブルを幽霊のように抜け、夜を firmware に落とした。アーニャは夜の市場型学習者に——時に無音の学習 app に反逆せよ。新しい一語を外に持ち、看板、笑い、雨の中で聞け。

彼女のカードは、乱雑で現実的な復習を正当化する。`,

      romaji: `Anya wa yoru no ichiba de "yoru" wo spin shi, majenta no baton ga nureta neon ni kanji wo egaita——saikou no goi wa kyoukasho ga toji, mimi ga hiraita toki okiru. Zora ga koko de yuuki wo kai, Emiru ga disguise wo katta——onaji yatai, chigau kamen.

Kojo ga zujou no keeburu wo yuurei no you ni nuke, yoru wo firmware ni otoshita. Anya wa yoru no ichiba-gata gakushuusha ni——toki ni musei no gakushuu app ni hangyaku seyo. Atarashii ichigo wo soto ni mochi, kanban, warai, ame no naka de kike.

Kanojo no kaado wa, ranzatsu de genjitsu-teki na fukushuu wo seitouka suru.`,
    },
  },

  ne_ghost: {
    originPlace: "The Netrunner Catacombs",
    originPlaceJa: "ネット走者の地下",
    whyItMatters:
      "Kojo hacks mnemonics — wire 零 to glitchy memory hooks that never fade.",
    whyItMattersJa:
      "コージョは、「零」をグリッチ記憶フックに配線する mnemonics の聞き手だ。",
    mentions: ["ne_titan", "re_zangetsu", "cu_domain"],
    body: {
      en: `Kojo jacked 零 (rei) in the Netrunner Catacombs, hood pulled low, code cascading like kanji radicals falling into place. Zero is not nothing — it is the reset that makes space for the next word. Kwame's moonfang uploaded rei as firmware; Mateus trapped rei inside a domain firewall until it behaved.

Bruna stomped overhead, chrome shaking the servers where Kojo stored borrowed mnemonics for sale — he never charged Listeners. He teaches digital-age learners: glitch imagery sticks. Picture rei as a broken counter that rolls over to victory.

Ghost his card into your deck when numbers blur.`,

      ja: `コージョはネット走者の地下で「零」に jack し、コードが部首のように落ちて嵌る。零は無ではない——次の語のための reset だ。クワメの月牙が零を firmware 化し、マテウスは領域 firewall に零を閉じ込めた。

ブルーナが上で stomp し、コージョが借り mnemonics を保管する server が揺れた——聞き手からは金を取らない。彼は digital 時代の学習者に——グリッチ imagery は残る。零を勝利に roll する壊れた counter と見よ。

数字が blur するとき、彼のカードを deck に ghost せよ。`,

      romaji: `Kojo wa netto hashiru no chika de "rei" ni jack shi, koodo ga bushu no you ni ochite hamaru. Rei wa mu de wa nai——tsugi no go no tame no reset da. Kwame no gekkiga ga rei wo firmware-ka shi, Mateusu wa ryouiki firewall ni rei wo tojikometa.

Buruuna ga ue de stomp shi, Kojo ga kari mnemonics wo hokan suru server ga yureta——kikite kara wa kin wo toranai. Kare wa digital jidai no gakushuusha ni——guritchi imagery wa nokoru. Rei wo shouri ni roll suru kowareta counter to miyo.

Suuji ga blur suru toki, kare no kaado wo dekki ni ghost seyo.`,
    },
  },

  ne_titan: {
    originPlace: "The Chrome Battleline",
    originPlaceJa: "クロム戦線",
    whyItMatters:
      "Bruna is full-metal retention — 鋼 vocabulary survives when everything else breaks.",
    whyItMattersJa:
      "ブルーナは、他が壊れても「鋼」の語彙だけは残る——完全定着の聞き手。",
    mentions: ["ne_spike", "vo_yonko", "sh_monarch"],
    body: {
      en: `Bruna anchored 鋼 (hagane) on the Chrome Battleline, rail-cannon humming, city detonating in colors that spelled steel in every language at once. Full conversion means full commitment — half-remembered kanji cannot live inside chrome. Diego ran the Wire Alley beneath her shadow; Olamide's sea-laugh shook her chest plate in sympathy.

Ravindra summoned shadows that hagane could not cut — only names could. Bruna tells advanced learners: some words must become bone. When hagane enters your long-term deck, stop letting it rust in short-term queues.

She is the UR of discipline wearing mercenary skin.`,

      ja: `ブルーナはクロム戦線で「鋼」を anchor し、レール砲が唸り、街が全言語同時に steel を綴って爆発した。フル conversion はフル commitment——半分覚えた漢字はクロムの中で生きられない。ディエゴが影の下の路地を走り、オラミデの海の笑いが胸板を共鳴させた。

ラヴィンドラが影を召喚し、鋼は切れなかった——名だけが切れた。ブルーナは上級学習者に告げる——ある語は骨になるべきだ。鋼が長期の deck に入ったら、短期の queue で錆ばせるな。

彼女は傭兵の皮を被った discipline の UR だ。`,

      romaji: `Buruuna wa kuromu sensen de "hagane" wo anchor shi, reeru hou ga unari, machi ga zen gengo douji ni steel wo tsuzutte bakuhatsu shita. Furu conversion wa furu commitment——hanbun oboeta kanji wa kuromu no naka de ikirarenai. Diego ga kage no shita no roji wo hashiri, Olamide no umi no warai ga muneita wo kyoumei saseta.

Ravindra ga kage wo shoukan shi, hagane wa kirenakatta——na dake ga kireta. Buruuna wa joukyuu gakushuusha ni tsugeru—— aru go wa hone ni naru beki da. Hagane ga chouki no dekki ni haitta ra, tanki no queue de sabi baseru na.

Kanojo wa youhei no kawa wo kabutta discipline no UR da.`,
    },
  },

  he_anya: {
    originPlace: "The Whispering Hearth of Lumenfeld",
    originPlaceJa: "ルーメンフェルトの囁き炉",
    whyItMatters:
      "Pip proves that 心 lands hardest when you feel a character's joy before you translate it.",
    whyItMattersJa:
      "ピップは、「心」が訳より先にキャラクターの喜びで胸に刺さる瞬間を証明する。",
    mentions: ["he_loid", "he_yor", "lu_hoshimi"],
    body: {
      en: `In the Whispering Hearth of Lumenfeld, Pip cracked 心 (kokoro) not by study but by overhearing — wide eyes pressed to a door while Émile rehearsed a lie and Leyla rehearsed tenderness in the same breath. The Luminara Thread hummed through biscuit crumbs on her palm. She did not know the kanji yet; she knew the feeling, and the feeling spelled it first.

Amaya's star bow flickered in a dream that night, distant as a promise. Pip whispered kokoro at breakfast; Biscuit thumped his tail in approval before anyone else spoke. Listeners are born when vocabulary stops being homework and becomes something you protect.

Collect Pip when emotional anime vocabulary intimidates you. Heart words need heart first — dictionaries arrive second, grateful.`,

      ja: `ルーメンフェルトの囁き炉で、ピップは「心」を勉強ではなく盗み聞きで掴んだ——エミールが嘘を、レイラが優しさを同じ息で練習する扉に、大きな目を押し付けて。ルミナラの糸が手のひらのビスケット屑を震わせた。漢字はまだ知らない。感覚だけ知っていて、感覚が先に綴った。

その夜、アマヤの星弓が約束のように遠く瞬いた。朝食でこころと漏らすと、ビスケットが誰より先に尾を打った。語彙が宿題をやめ、守るものになった瞬間、聞き手が生まれる。

感情アニメ語彙が怖いとき、ピップを集めよ。心の語は心が先——辞書は後から、感謝して来る。`,

      romaji: `Ruumenferuto no sasayaki ro de, Pippu wa "kokoro" wo benkyou de wa naku, kikikiki de tsukanda——Emiru ga uso wo, Reira ga yasashisa wo onaji iki de renshuu suru tobira ni, ooki na me wo oshitsukete. Ruminara no ito ga te no hira no bisukeetto kuzu wo furawaseta. Kanji wa mada shiranai. Kankaku dake shitte ite, kankaku ga saki ni tsuzutta.

Sono yoru, Amaya no hoshiyumi ga yakusoku no you ni tooku matataita. Choushoku de kokoro to morasu to, Bisukeetto ga dare yori saki ni o wo utta. Goi ga shukudai wo yame, mamoru mono ni natta shunkan, kikite ga umareru.

Kanjou anime goi ga kowai toki, Pippu wo atsumeyo. Kokoro no go wa kokoro ga saki——jisho wa ato kara, kansha shite kuru.`,
    },
  },

  he_loid: {
    originPlace: "The Mirrorhall Safehouse",
    originPlaceJa: "鏡間の safehouse",
    whyItMatters:
      "Émile teaches that 父 is not textbook family — it is the role you practice until it becomes true.",
    whyItMattersJa:
      "エミールは、「父」は教科書の家族ではなく、本当になるまで演じる役割だと教える。",
    mentions: ["he_yor", "he_bond", "ne_rebel"],
    body: {
      en: `Émile learned 父 (chichi) in the Mirrorhall Safehouse, adjusting a tie before a mirror that showed seven disguises and one tired man underneath. Fatherhood was his longest con — and the only one the Luminara Thread refused to laugh at. Leyla's ladle clinked in the kitchen; each sound anchored the syllable deeper than any flashcard.

Anya sold neon courage two districts away; Biscuit dreamed futures where chichi was spoken without rehearsal. Émile finally said it aloud to Pip, badly, honestly — and the Thread blazed warm through the apartment walls.

His card is for learners building found-family vocabulary. Practice the word until the mask fits your mouth.`,

      ja: `エミールは鏡間の safehouse で「父」を学んだ。七つの disguise と、その下の疲れた男を映す鏡の前でネクタイを直しながら。父であることは最長の詐欺——糸だけが笑わなかった唯一の詐欺だ。レイラのおたまが台所で触れ、音が flashcard より深く音节を anchor した。

アーニャが二区画先でネオンの勇気を売り、ビスケットはリハーサルなしに父と言える未来を見た。エミールはついにピップに向け、下手で、誠実に発声した——糸がアパートの壁を温かく走った。

彼のカードは、作り上げた家族語彙を組む学習者のため。言葉が口に馴染むまで演じよ。`,

      romaji: `Emiru wa kagama no safehouse de "chichi" wo mananda. Nanatsu no disguise to, sono shita no tsukareta otoko wo utsusu kagami no mae de nekutai wo naosinagara. Chichi de aru koto wa saichou no sagi——ito dake ga warawanakatta yuiitsu no sagi da. Reira no otama ga daidokoro de fure, oto ga furasshukaado yori fukaku ksetsu wo anchor shita.

Anya ga ni-gai kaku saki de neon no yuuki wo uri, Bisukeetto wa rihaasaru nashi ni chichi to ieru mirai wo mita. Emiru wa tsui ni Pippu ni muke, heta de, seijitsu ni hassei shita——ito ga apaato no kabe wo atatakaku hashitta.

Kare no kaado wa, tsukuriageta kazoku goi wo kumu gakushuusha no tame. Kotoba ga kuchi ni nare ru made enjiyo.`,
    },
  },

  he_yor: {
    originPlace: "The Thorn Kitchen Sanctum",
    originPlaceJa: "茨の台所 sanctum",
    whyItMatters:
      "Leyla holds 刺 — sharp words hide in gentle scenes until you learn to read both at once.",
    whyItMattersJa:
      "レイラは「刺」を抱える——優しい場面に鋭い語が潜むことを、同時に読む目を育てる。",
    mentions: ["sp_kama", "he_anya", "ch_knight"],
    body: {
      en: `Leyla balanced 刺 (shi) in the Thorn Kitchen Sanctum, ladle in one hand and a hairpin-dagger in the other, because homemaking and danger share a grammar in spy families. The Luminara Thread glinted on steel and steam alike. Kama's fox-fire warmed the stove from a folktale lane Pip had never visited; Sir Pebble's cardboard courage echoed from a child's game on the news.

She whispered shi while chopping radish — not threat, but precision. Learners who miss double meanings need Leyla: the same stroke can feed you or warn you. Pip giggled at the cutting board; Leyla smiled because laughter is also vocabulary.

Unlock her when gentle anime scenes still hide knives in the subtitles.`,

      ja: `レイラは茨の台所 sanctum で「刺」を均衡させた。片手におたま、もう片手に簪の短剣——スパイ家族では家政と危険が文法を分かち合う。ルミナラの糸が鋼と湯気の両方に瞬いた。カマの狐火が stove を温め、ピップの行ったことのない folktale 路地から。ニュースの子供遊びでサー・ペブルの段ボール勇気がこだました。

大根を切りながら刺と囁いた——脅しではなく、精密さだ。二重の意味を見逃す学習者にレイラが要る。同じ一振りが食べさせることも警告することもある。ピップがまな板でくすくす笑い、レイラも笑った——笑いも語彙だから。

優しいアニメ場面に字幕の刃が隠れているとき、彼女を開け。`,

      romaji: `Reira wa ibara no daidokoro sankuchuamu de "shi" wo kinkou saseta. Katate ni otama, mou katate ni kanzashi no tantou——supai kazoku de wa kasei to kiken ga bunpou wo wakachiau. Ruminara no ito ga hagane to yuge no ryouhou ni matataita. Kama no kitsunebi ga stove wo atatame, Pippu no itta koto no nai folktale roji kara. Nyuusu no kodomo asobi de Saa Peburu no danbouru yuuki ga kodama shita.

Daikon wo kirinagara shi to sasayaita——odoshi de wa naku, seimitsu-sa da. Nijuu no imi wo minogasu gakushuusha ni Reira ga iru. Onaji ichiburui ga tabesaseru koto mo keikoku suru koto mo aru. Pippu ga manaita de kusukusu warai, Reira mo waratta——warai mo goi da kara.

Yasashii anime baamen ni jimaku no yaiba ga kakurete iru toki, kanojo wo hirake.`,
    },
  },

  he_bond: {
    originPlace: "The Precognitive Sunroom",
    originPlaceJa: "予知の日室",
    whyItMatters:
      "Biscuit senses 予 before you do — trust the word that arrives a flashcard ahead of the scene.",
    whyItMattersJa:
      "ビスケットは「予」をあなたより先に感じる——場面より一枚早い語を信じよ。",
    mentions: ["he_loid", "po_aqua", "ch_dragon"],
    body: {
      en: `Biscuit dreamed 予 (yo) in the Precognitive Sunroom, cream fur warmed by glass that showed tomorrow's subtitles scrolling backward. Dogs do not parse kanji — they parse intention. The Luminara Thread tugged his knitted cape when Émile was about to forget a gentle word; Tidepup splashed the same syllable as wave-omen on a distant shore.

Nibbles puffed smoke rings that spelled yo in dragon puff, ridiculous and true. Biscuit thumped twice for learners who swear they cannot predict readings: yo is the future tense of study — you will need it before you know you will.

His SR card rewards those who review one card ahead of the episode.`,

      ja: `ビスケットは予知の日室で「予」を夢見た。明日の字幕が逆再生するガラスに照らされたクリーム色の毛。犬は漢字を parse しない——意図を parse する。エミールが優しい一語を忘れそうなとき、ルミナラの糸が編み cape を引いた。遠い岸でタイドパップが波の兆しとして同じ音节を splash した。

ニブルズが yo を dragon puff で綴る煙輪を吐き、ばかげていて真実だった。ビスケットは二度尾を打った——読みが予測できないと言う学習者へ。予は学習の未来形——必要だと分かる前に要る。

彼の SR カードは、エピソードより一枚先に復習する者に報いる。`,

      romaji: `Bisukeetto wa yochi no nissitsu de "yo" wo yumemita. Ashita no jimaku ga gyakusaisei suru garasu ni terasareta kuriimu-iro no ke. Inu wa kanji wo parse shinai——ito wo parse suru. Emiru ga yasashii ichigo wo wasuresou na toki, Ruminara no ito ga ami cape wo hiita. Tooi kishi de Taidopappu ga nami no kizashi to shite onaji ksetsu wo splash shita.

Niburuzu ga yo wo dragon puff de tsuzuru kemuriwa wo haki, bakagete ite shinjitsu datta. Bisukeetto wa nido o wo utta——yomi ga yosoku dekinai to iu gakushuusha e. Yo wa gakushuu no mirai-kei——hitsuyou da to wakaru mae ni iru.

Kare no SR kaado wa, episoodo yori ichimai saki ni fukushuu suru mono ni mukuiru.`,
    },
  },

  ps_mob: {
    originPlace: "The Still Eye Alley",
    originPlaceJa: "静眼の路地",
    whyItMatters:
      "Haru shows that 気 explodes only after calm — master the quiet reading first.",
    whyItMattersJa:
      "ハルは、「気」は静寂の後にだけ爆ぜる——静かな読みを先に極めよと示す。",
    mentions: ["ps_dimple", "ps_reigen", "cu_rei"],
    body: {
      en: `Haru held 気 (ki) in the Still Eye Alley, bowl-cut unchanged while aurora-scale psychic noise shredded billboards behind him. Power without vocabulary is just noise; he learned that from Baba Kunle between cons. The Luminara Thread ran cool through his deadpan — ki must be spoken plain before it can be spoken loud.

Blip orbited smugly, teal nonsense translating ki into ghost-laughter. Idris cracked a cursed syllable blocks away; Haru felt the echo and did not flinch. His hundred-percent is not rage — it is clarity arriving all at once.

Collect Haru when overwhelm makes you skip the simple readings. Calm is also fluency.`,

      ja: `ハルは静眼の路地で「気」を抱えた。ボウルカットは変わらず、サイケデリックなオーラが看板を裂いた。力に語彙がなければ雑音にすぎない——詐欺の合間にババ・クンレから学んだ。ルミナラの糸がデッドパンを冷たく走り——気は大きく言う前に、平らに言わねばならない。

ブリップが得意げに周回し、 teal の nonsense が気を霊の笑いに訳した。数街区先でイドリスが呪音节を砕き、ハルはこだまを感じても flinch しなかった。百パーセントは怒りではない——一度に来る明晰さだ。

圧倒されて簡単な読みを飛ばすとき、ハルを集めよ。静けさも流暢さだ。`,

      romaji: `Haru wa seigan no roji de "ki" wo daaketa. Boorukatto wa kawarazu, saikederikku na aura ga kanban wo saita. Chikara ni goi ga nakereba zatsuon ni suginai——sagi no aida ni Baba Kunle kara mananda. Ruminara no ito ga deddopan wo tsumetaku hashiri——ki wa ookiku iu mae ni, taira ni iwaneba naranai.

Burippu ga tokui ge ni shuukai shi, teal no nonsense ga ki wo rei no warai ni yakushita. Suugai ku saki de Idrisu ga noroi ksetsu wo kudaki, Haru wa kodama wo kanjite mo flinch shinakatta. Hyaku paasento wa ikari de wa nai——ichido ni kuru meikisa da.

Attou sarete kantan na yomi wo tobasu toki, Haru wo atsumeyo. Shizukesa mo ryuuchousa da.`,
    },
  },

  ps_dimple: {
    originPlace: "The Teal Wisp Loft",
    originPlaceJa: "ティールの wisp  attic",
    whyItMatters:
      "Blip treats 霊 as playground — even spirit readings stick when you stop fearing them.",
    whyItMattersJa:
      "ブリップは「霊」を遊び場にする——恐れをやめれば霊の読みも定着する。",
    mentions: ["ps_mob", "ne_spike", "ch_mocha"],
    body: {
      en: `Blip learned 霊 (rei) in the Teal Wisp Loft, a smug grin floating above ramen steam because ghosts memorize faster when they mock the living. The Luminara Thread spiraled through swirl-eyes. Haru stood below, deadpan anchor; Diego sprinted wire-alley den through rei as static; Mochi hugged a rice ball that looked suspiciously like a tiny spirit.

Blip insists rei is not horror-only — it is presence, echo, the reading behind the reading. Learners who skip supernatural decks lose half of autumn anime vocabulary.

Keep Blip when 霊 compounds feel cursed. Laugh once; then repeat until rei sticks.`,

      ja: `ブリップはティールの wisp attic で「霊」を学んだ。ラーメンの湯気の上で得意げな笑み——幽霊は生者を嘲れば早く覚える。ルミナラの糸が渦目を螺旋した。下でハルがデッドパンのアンカー、ディエゴが路地の電を rei として static 走り、モチが小さな霊みたいなおにぎりを抱いた。

ブリップは言う——霊はホラー専用ではない。存在、こだま、読みの裏の読みだ。超自然デッキを skip する学習者は秋アニメ語彙の半分を失う。

霊熟語が呪われて感じるとき、ブリップを保て。一度笑え。それから rei が付くまで繰り返せ。`,

      romaji: `Burippu wa tiiru no wisp attic de "rei" wo mananda. Raamen no yuge no ue de tokui ge na warimi——yuurei wa seisha wo azawaraba hayaku oboeru. Ruminara no ito ga uzu-me wo rasen shita. Shita de Haru ga deddopan no ankaa, Diego ga roji no den wo rei to shite static hashiri, Mochi ga chiisana rei mitai na onigiri wo daaita.

Burippu wa iu——rei wa horaa senyou de wa nai. Sonzai, kodama, yomi no ura no yomi da. Choushizen dekki wo skip suru gakushuusha wa aki anime goi no hanbun wo ushinau.

Rei jukugo ga norowarete kanjiru toki, Burippu wo tamote. Ichido warae. Sore kara rei ga tsuku made kurikaese.`,
    },
  },

  ps_reigen: {
    originPlace: "The Salt Circle Agency",
    originPlaceJa: "塩輪の agency",
    whyItMatters:
      "Baba Kunle sells 師 with flair — confidence in the reading is half of knowing it.",
    whyItMattersJa:
      "ババ・クンレは「師」を派手に売る——読みへの自信は、知識の半分だ。",
    mentions: ["ps_awaken", "cu_domain", "vo_yonko"],
    body: {
      en: `Baba Kunle proclaimed 師 (shi) from the Salt Circle Agency, pinch of salt mid-air, suit too shiny for honesty and perfect for teaching. Master is a performance until it isn't — the Luminara Thread applauded his bluff because apprentices need someone who acts like words are easy. Haru △ later proved shi in cosmic silence; Mateus folded a domain around the same title until it became real.

Olamide laughed from a pirate throne, calling every master a sailor of synonyms. Kunle bowed — oceans agree. His card is for learners ashamed of slow progress. Point at the kanji like you own it; ownership follows gesture.

Unlock him when impostor syndrome blocks your reviews.`,

      ja: `ババ・クンレは塩輪の agency から「師」を宣言した。空中の塩一つまみ、誠実には光りすぎるスーツ——教えるには完璧。師は演じるまで演じ、演じない瞬間が来る。ルミナラの糸は bluff に拍手した——見習いには言葉が簡単そうな人が要る。後にハル △ が宇宙の沈黙で師を証明し、マテウスが同じ称号を領域に折り畳んだ。

オラミデが海賊の玉座から笑い、師は皆同義語の船員だと言った。クンレは礼をした——海は同意する。彼のカードは、遅い進歩を恥じる学習者のため。漢字を所有するように指せ——所有は gesture に従う。

インポスター症候群が復習を塞ぐとき、彼を開け。`,

      romaji: `Baba Kunle wa shoen no agency kara "shi" wo sengen shita. Kuuchuu no shio hitotsumami, seijitsu ni wa hikarisugiru suutsu——oshieru ni wa kanpeki. Shi wa enjiru made enji, enjinai shunkan ga kuru. Ruminara no ito wa bluff ni hakushu shita——minarai ni wa kotoba ga kantan sou na hito ga iru. Ato ni Haru △ ga uchuu no chinmoku de shi wo shoumei shi, Mateusu ga onaji shougou wo ryouiki ni oritanda.

Olamide ga kaizoku no gyokza kara warai, shi wa mina dougigo no senin da to itta. Kunle wa rei wo shita——umi wa doui suru. Kare no kaado wa, osoi shinpo wo haji suru gakushuusha no tame. Kanji wo shoyuu suru you ni yubase——shoyuu wa gesture ni shitagau.

Inposutaa shoukougun ga fukushuu wo fusagu toki, kare wo hirake.`,
    },
  },

  ps_awaken: {
    originPlace: "The Concentric Collapse",
    originPlaceJa: "同心の崩落",
    whyItMatters:
      "Haru △ embodies 覚 — awakening is when every old reading rearranges into one clear pattern.",
    whyItMattersJa:
      "ハル △ は「覚」の体——目覚めとは、古い読みすべてが一つの明晰な型に並び替わる瞬間だ。",
    mentions: ["ps_mob", "me_unit", "ho_rain"],
    body: {
      en: `Haru △ spoke 覚 (kaku) at the Concentric Collapse, body outlined in light while reality folded into rings — not destruction, but recognition at scale. The plain boy and the cosmic boy share one Thread. Unit Kappa's restraint mask flickered kaku in warning orange; Dao's rain wrote the same character across a rooftop sky.

Mob Psycho learners know the plateau before explosion. kaku is that plateau breaking into understanding: every drilled ki, rei, shi suddenly composes. △ is not a different person — it is vocabulary when it finally connects.

Ascend his card when reviews feel circular. The circle is a spiral; you are closer than you think.`,

      ja: `ハル △ は同心の崩落で「覚」を発した。光の輪郭の体、現実が環状に折り畳まれる——破壊ではなく、規模の認識。平凡な少年と宇宙の少年は一本の糸を分かつ。ユニット・カッパの拘束マスクが覚を警告の橙で点滅し、ダオの雨が屋上の空に同字を書いた。

サイケ学習者は爆発前の plateau を知る。覚はその plateau が理解へ割れる瞬間—— drill した気、霊、師が suddenly 合成する。△ は別人ではない——ついに繋がった語彙だ。

復習が円を描くとき、彼のカードを ascende せよ。円は螺旋——思うより近い。`,

      romaji: `Haru △ wa doushin no houraku de "kaku" wo hass shita. Hikari no rinkaku no karada, genjitsu ga kanjou ni oritobasareru——hakai de wa naku, kibo no ninshiki. Heibon na shounen to uchuu no shounen wa ippon no ito wo wakatsu. Yunitto Kappa no kousoku masuku ga kaku wo keikoku no daidai de tenmetsu shi, Dao no ame ga okujou no sora ni douji wo kaita.

Psyche gakushuusha wa bakuhatsu mae no plateau wo shiru. Kaku wa sono plateau ga rikai e sakeru shunkan—— drill shita ki, rei, shi ga suddenly gousei suru. △ wa betsu jin de wa nai——tsui ni tsunagatta goi da.

Fukushuu ga en wo egaku toki, kare no kaado wo ascende seyo. En wa rasen—— omou yori chikai.`,
    },
  },

  me_shin: {
    originPlace: "The Third Cockpit Hollow",
    originPlaceJa: "第三コックピットの hollow",
    whyItMatters:
      "Elias carries 使 — pilot vocabulary is duty words you speak even when your hands shake.",
    whyItMattersJa:
      "エリアスは「使」を担う——パイロット語彙は、手が震えても発する務めの言葉だ。",
    mentions: ["me_asuka", "ti_grim", "ps_mob"],
    body: {
      en: `Elias whispered 使 (shi) in the Third Cockpit Hollow, neural clips cold against his scalp, because being chosen to use language is not the same as wanting it. The Luminara Thread ran through LCL-colored silence. Rania's crimson unit shouted shi across the hangar; Zola's founder shadow measured the same syllable in a grimmer register. Haru stood on a psychic alley miles away, proving shi can be quiet too.

Elias is the Listener for reluctant learners — the ones who open the app and close it twice. shi means use, employ, serve: you are already using Japanese every time you try.

Hold his card when avoidance feels safer than another mistake.`,

      ja: `エリアスは第三コックピットの hollow で「使」を囁いた。神経クリップが頭皮に冷たく——言語を使うよう選ばれることは、望むことと同じではない。ルミナラの糸が LCL 色の沈黙を走った。ラニアの紅の unit が格納庫で使を叫び、ゾーラの founder 影がより grim な register で同音节を測った。遠くの路地でハルが立ち、使は静かでもよいと証明した。

エリアスは reluctant 学習者の聞き手——アプリを開いて二度閉じる者たち。使は用いる、務める：試すたびにすでに日本語を使っている。

回避がまた間違えるより安全に感じるとき、彼のカードを握れ。`,

      romaji: `Eriasu wa daisan kokkupitto no hollow de "shi" wo sasayaita. Shinkei kurippu ga touhi ni tsumetaku—— gengo wo tsukau you erabareru koto wa, nozomu koto to onaji de wa nai. Ruminara no ito ga LCL-iro no chinmoku wo hashitta. Rania no kurenai unit ga kakouniku de shi wo sakebi, Zora no founder kage ga yori grim na register de onaji ksetsu wo hakatta. Tooku no roji de Haru ga tachi, shi wa shizuka demo yoi to shoumei shita.

Eriasu wa reluctant gakushuusha no kikite—— apuri wo hiraite nido tojiru mono-tachi. Shi wa mochiiru, tsutomeru: tamesu tabi ni sude ni nihongo wo tsukatte iru.

Kaihi ga mata machigae ru yori anzen ni kanjiru toki, kare no kaado wo nigire.`,
    },
  },

  me_asuka: {
    originPlace: "The Red Interface Catwalk",
    originPlaceJa: "赤 interface の catwalk",
    whyItMatters:
      "Rania fires 紅 into your pride — competitive learners memorize faster when ego joins the drill.",
    whyItMattersJa:
      "ラニアは「紅」を自尊に撃ち込む——競争心が drill に加われば、記憶は速くなる。",
    mentions: ["me_shin", "me_unit", "lu_venus"],
    body: {
      en: `Rania stamped 紅 (beni) along the Red Interface Catwalk, arms crossed, headset glowing — second place is a vocabulary failure. The Luminara Thread matched her crimson plugsuit pulse. Elias muttered shi below; Unit Kappa's zero-eye watched without blinking. Camila chained beni to love-readings on a parallel arena, proving even soft genres steal color words from pilots.

Rania does not coddle. She is for learners who need a rival deck: beat yesterday's accuracy, shout beni until crimson kanji stop intimidating.

Deploy her when your study streak dies of boredom.`,

      ja: `ラニアは赤 interface の catwalk に「紅」を刻んだ。腕を組み、ヘッドセットが glow——二位は語彙の敗北だ。ルミナラの糸が彼女の紅 plugsuit の脈と同期した。下でエリアスが使を mutter し、ユニット・カッパの零の目が blink せず見た。カミラが parallel arena で紅を愛の読みに鎖し、 soft genre も pilot から色語を盗むと証明した。

ラニアは甘やかさない。ライバル deck が要る学習者のため——昨日の正確さを破れ、 crimson 漢字が怖くなくなるまで beni を叫べ。

 study streak が退屈で死ぬとき、彼女を deploy せよ。`,

      romaji: `Rania wa aka interface no catwalk ni "beni" wo kizanda. Ude wo kumi, heddosetto ga glow—— nii wa goi no haiboku da. Ruminara no ito ga kanojo no beni plugsuit no myaku to douki shita. Shita de Eriasu ga shi wo mutter shi, Yunitto Kappa no rei no me ga blink sezu mita. Kamira ga parallel areena de beni wo ai no yomi ni kusashi, soft genre mo pilot kara irogo wo nusmu to shoumei shita.

Rania wa amayakasanai. Raibaru dekki ga iru gakushuusha no tame—— kinou no seikakusa wo yabure, crimson kanji ga kowakunaku naru made beni wo sakebe.

Study streak ga taikutsu de shinu toki, kanojo wo deploy seyo.`,
    },
  },

  me_unit: {
    originPlace: "The Restraint Vault Zero",
    originPlaceJa: "拘束 vault 零",
    whyItMatters:
      "Unit Kappa anchors 零 — the reset kanji that makes room for every pilot term after it.",
    whyItMattersJa:
      "ユニット・カッパは「零」を anchor する——その後の pilot 語すべての余地を作る reset 漢字だ。",
    mentions: ["me_angel", "cu_king", "ps_awaken"],
    body: {
      en: `Unit Kappa locked 零 (rei) inside the Restraint Vault Zero, single eye pulsing behind a mask that said do not proceed until you mean it. Zero is not emptiness — it is calibrated silence before sync. The Luminara Thread trembled in orange warning. The Pattern's geometry folded around the vault lip; Vesna counted rei as disaster deferred; Haru △ woke when rei finally unlatched in psychic sky.

Mecha decks drown in numbers. Unit Kappa teaches one numeral kanji until it becomes cockpit grammar.

Fear his card appropriately. rei is the pause that saves the next ten words.`,

      ja: `ユニット・カッパは拘束 vault 零の中で「零」を lock した。本気になるまで進むなと言うマスクの後ろで単眼が脈打つ。零は空ではない—— sync 前の calibrated 沈黙。ルミナラの糸が橙警告で震えた。パターンの幾何が vault の縁を折り、ヴェスナが零を先延ばしの災と数え、ハル △ が psychic 空で零が unlatch されたとき目覚めた。

 Mecha deck は数字に溺れる。ユニット・カッパは一つの数漢字を cockpit 文法になるまで教える。

彼のカードを適切に恐れよ。零は次の十語を救う pause だ。`,

      romaji: `Yunitto Kappa wa kousoku vault rei no naka de "rei" wo lock shita. Honki ni naru made susumu na to iu masuku no ushiro de tangan ga myakuutsu. Rei wa kuu de wa nai—— sync mae no calibrated chinmoku. Ruminara no ito ga daidai keikoku de furue ta. Pataan no kikaku ga vault no fuchi wo ori, Vesna ga rei wo sakinobashi no wazai to kazoe, Haru △ ga psychic sora de rei ga unlatch sareta toki mezameta.

Mecha dekki wa suuji ni oboreru. Yunitto Kappa wa hitotsu no suuji kanji wo cockpit bunpou ni naru made oshieru.

Kare no kaado wo tekisetsu ni osoreyo. Rei wa tsugi no juugo wo sukuu pause da.`,
    },
  },

  me_angel: {
    originPlace: "The Absolute Pattern Throne",
    originPlaceJa: "絶対 pattern の玉座",
    whyItMatters:
      "The Pattern descends with 神 — theological anime vocabulary demands reverence, not speed.",
    whyItMattersJa:
      "パターンは「神」と共に降りる——神学アニメ語彙は速さより敬いを要する。",
    mentions: ["me_unit", "lu_queen", "re_king"],
    body: {
      en: `The Pattern inscribed 神 (kami) on the Absolute Pattern Throne, cross-light perfect, because some kanji are not drilled — they are witnessed. Angels parse last; humans parse first; the Luminara Thread connects both orders. Unit Kappa's zero held the door; Seraphine's millennium bowed from a silver palace; Sable acknowledged kami from void without speech.

SSR theology words arrive late in every learner's journey. The Pattern is patience made geometry — read kami slowly, let subtitle silence count as study.

Ascend when mecha arcs turn metaphysical. This card is the ceiling, not the floor.`,

      ja: `パターンは絶対 pattern の玉座に「神」を刻んだ。十字光が perfect——ある漢字は drill されず、witness される。天使は最後に parse し、人間は最初——ルミナラの糸が両順序を繋ぐ。ユニット・カッパの零が扉を押さえ、セラフィーヌの千年が銀 palace から bow し、セイブルが虚空から無言で神を認めた。

 SSR 神学語はすべての学習者の旅の遅い方へ来る。パターンは忍耐の幾何——神をゆっくり読め、字幕の沈黙も study と数えよ。

 mecha arc が形而上に転じるとき ascende せよ。このカードは床ではなく天井だ。`,

      romaji: `Pataan wa zettai pattern no gyokza ni "kami" wo kizanda. Juuji hikari ga perfect—— aru kanji wa drill sarezu, witness sareru. Tenshi wa saigo ni parse shi, ningen wa saisho—— Ruminara no ito ga ryoujunjo wo tsunagu. Yunitto Kappa no rei ga tobira wo osae, Serafinu no sennen ga gin palace kara bow shi, Sable ga kyokuu kara mugon de kami wo mitometa.

SSR shingaku go wa subete no gakushuusha no tabi no osoi hou e kuru. Pataan wa nintai no kikaku—— kami wo yukkuri yome, jimaku no chinmoku mo study to kazoe yo.

Mecha aaku ga keijijou ni tenjiru toki ascende seyo. Kono kaado wa yuka de wa naku tenjou da.`,
    },
  },

  ho_taki: {
    originPlace: "The Twin-Sky Overlook",
    originPlaceJa: "双空の overlook",
    whyItMatters:
      "Jun gazes at 空 — distance vocabulary lands when you name the sky between two places.",
    whyItMattersJa:
      "ジュンは「空」を見つめる——二つの場所の間の空に名を与えるとき、距離の語彙が定着する。",
    mentions: ["ho_mitsu", "sp_umi", "po_satoru"],
    body: {
      en: `Jun traced 空 (sora) on the Twin-Sky Overlook, golden hour splitting the horizon into two impossible weathers — because longing has its own grammar. The Luminara Thread shimmered between clouds. Ingrid's red cord mirrored sora at twilight; Kai's ocean altar repeated the syllable in salt spray; Rafa waved from a sunny meadow, unaware the same sky connected them.

Horizon Listeners teach place-words: sora is not just sky — it is the space between selves. Shinkai learners know the ache; Jun names it so flashcards stop feeling trivial.

Collect him when scenery subtitles move you more than dialogue.`,

      ja: `ジュンは双空の overlook で「空」を辿った。黄金時間が horizon を二つの不可能な天候に裂き——憧れには独自の文法がある。ルミナラの糸が雲の間で瞬いた。インリッドの赤い糸が黄昏の空を映し、カイの海 altar が塩 spray で同音节を繰り返し、ラファが陽の meadow から手を振った——同じ空が繋いでいるとは知らず。

 horizon 聞き手は場所の語を教える。空はただの sky ではない——自己の間の space だ。新海学習者は ache を知る。ジュンはそれに名を与え、 flashcard が trivial に感じなくさせる。

 scenery 字幕が dialogue より動かすとき、彼を集めよ。`,

      romaji: `Jun wa soukuu no overlook de "sora" wo tadotta. Ougon jikan ga horizon wo futatsu no fukkanou na tenkou ni saki—— akogare ni wa dokuji no bunpou ga aru. Ruminara no ito ga kumo no aida de matataita. Ingrid no akai ito ga tasogare no sora wo utsushi, Kai no umi altar ga shio spray de onaji ksetsu wo kurikaeshi, Rafa ga hi no meadow kara te wo futta—— onaji sora ga tsunaide iru to wa shirazu.

Horizon kikite wa basho no go wo oshieru. Sora wa tada no sky de wa nai—— jiko no aida no space da. Shinkai gakushuusha wa ache wo shiru. Jun wa sore ni na wo ataeru, furasshukaado ga trivial ni kanji naku saseru.

Scenery jimaku ga dialogue yori ugokasu toki, kare wo atsumeyo.`,
    },
  },

  ho_mitsu: {
    originPlace: "The Red Cord Observatory",
    originPlaceJa: "赤糸の observatory",
    whyItMatters:
      "Ingrid braids 糸 — fate vocabulary ties separate study sessions into one continuous story.",
    whyItMattersJa:
      "インリッドは「糸」を編む——運命語彙がばらばらの学習を一つの連続した物語に結ぶ。",
    mentions: ["ho_taki", "sl_honoka", "lu_tsukina"],
    body: {
      en: `Ingrid braided 糸 (ito) at the Red Cord Observatory, comet streak overhead, because some kanji are threads you feel before you read. Jun's twin sky pulled one end; Devika's first flame warmed another; Noor's moon tiara knotted ito to tsuki without asking permission. The Luminara Thread is not metaphor to her — it is the thing she holds.

Learners who study in fragments need Ingrid: ito links today's word to yesterday's. Braid reviews; trust the cord.

Unlock her when your deck feels scattered. Fate is continuity, not luck.`,

      ja: `インリッドは赤糸の observatory で「糸」を編んだ。頭上に彗星——ある漢字は読む前に感じる糸だ。ジュンの双空が一端を引き、デヴィカの最初の炎がもう一端を温め、ヌールの月 tiara が許可なく糸を月に結んだ。ルミナラの糸は比喩ではない——彼女が握るものだ。

断片で学ぶ者にインリッドが要る。糸は今日の語を昨日に結ぶ。復習を編め。糸を信じよ。

 deck が scattered に感じるとき、彼女を開け。運命は連続性であり、 luck ではない。`,

      romaji: `Ingrid wa akaito no observatory de "ito" wo anda. Zujou ni suisei—— aru kanji wa yomu mae ni kanjiru ito da. Jun no soukuu ga ichitan wo hiki, Devika no saisho no honoo ga mou ichitan wo atatame, Nuuru no tsuki tiara ga kyoka naku ito wo tsuki ni musunda. Ruminara no ito wa hiyu de wa nai—— kanojo ga nigiru mono da.

Danpen de manabu mono ni Ingrid ga iru. Ito wa kyou no go wo kinou ni musubu. Fukushuu wo ame. Ito wo shinji yo.

Dekki ga scattered ni kanjiru toki, kanojo wo hirake. Unmei wa renzokusei de ari, luck de wa nai.`,
    },
  },

  ho_rain: {
    originPlace: "The Clearing Storm Rooftop",
    originPlaceJa: "晴れ間の storm 屋上",
    whyItMatters:
      "Dao breaks 雨 into light — weather kanji click when you hear them in real rain.",
    whyItMattersJa:
      "ダオは「雨」を光に割る——本当の雨の中で聞いたとき、天候漢字が嵌る。",
    mentions: ["ho_comet", "sl_mizuho", "ps_awaken"],
    body: {
      en: `Dao reached through 雨 (ame) on the Clearing Storm Rooftop, droplets sparking into subtitles she could read without looking — weather words need weather, not apps. The Luminara Thread ran wet and bright. Tenzin had split ame from a waterfall decades upstream; The Long Return comet wrote sui through the same clouds; Haru △ felt ame as psychic static and called it honest.

Dao is the Listener for immersion purists: walk outside with one ame compound on your tongue. Let the sky grade your pronunciation.

Summon her card during monsoon season — or any day you forget Japanese lives in air.`,

      ja: `ダオは晴れ間の storm 屋上で「雨」に手を伸ばした。水滴が subtitle となり、見ずに読めた——天候語は app ではなく天候が要る。ルミナラの糸が濡れて明るく走った。テンジンが上流で滝から雨を裂いたのは何十年も前。長い帰還の彗星が同じ雲に彗を書き、ハル △ が雨を psychic static と感じ、正直だと呼んだ。

ダオは immersion  purist の聞き手——外に出て一つの雨熟語を舌に載せよ。空に発音を採点させろ。

季節雨の季節、あるいは日本語が air に生きているのを忘れた日に、彼女のカードを summon せよ。`,

      romaji: `Dao wa harema no storm okujou de "ame" ni te wo nobashita. Suiteki ga subtitle to nari, mizu ni yometa—— tenkou go wa app de wa naku tenkou ga iru. Ruminara no ito ga nurete akaruku hashitta. Tenzin ga jouryuu de taki kara ame wo saita no wa nanjuu nen mo mae. Nagai kikan no suisei ga onaji kumo ni sui wo kaki, Haru △ ga ame wo psychic static to kanji, shoujitsu da to yonda.

Dao wa immersion purist no kikite—— soto ni dete hitotsu no ame jukugo wo shita ni noseyo. Sora ni hatsuon wo saiten sase ro.

Kisetsu-ame no kisetsu, aruwa nihongo ga air ni ikite iru no wo wasureta hi ni, kanojo no kaado wo summon seyo.`,
    },
  },

  ho_comet: {
    originPlace: "The Twelve-Century Ridge",
    originPlaceJa: "十二世紀の ridge",
    whyItMatters:
      "The Long Return writes 彗 once — rare words matter because they arrive on schedules longer than your streak.",
    whyItMattersJa:
      "長い帰還は「彗」を一度だけ書く——稀な語は streak より長い周期で来るからこそ重要だ。",
    mentions: ["ho_mitsu", "ho_taki", "lu_queen"],
    body: {
      en: `The Long Return etched 彗 (sui) across the Twelve-Century Ridge, two silhouettes small beneath a sky impossible to fake — comet vocabulary is interval vocabulary. You will not see sui daily; you will remember it forever when you do. The Luminara Thread burned turquoise for one night. Ingrid's cord pointed upward; Jun's twin sky held the horizon still; Seraphine archived sui beside kisaki in silver millennium ledgers.

SSR horizon words reward collectors who do not chase only N-rarity drills. The comet returns; so will your need for this reading.

Witness this card when rare kanji appear once in a film and haunt you for years.`,

      ja: `長い帰還は十二世紀の ridge に「彗」を刻んだ。偽れない空の下、二つの silhouette は小さい——彗星語彙は interval 語彙だ。sui を毎日見ない。見たとき、永遠に覚える。ルミナラの糸が一夜 turquoise で燃えた。インリッドの糸が上を指し、ジュンの双空が horizon を静止させ、セラフィーヌが sui を后と並べ銀千年の ledger に archived した。

 SSR horizon 語は N レア drill だけ追う収集家に報いる。彗星は帰る——この読みの必要もまた帰る。

映画で一度だけ現れ、数年 haunt する稀漢字のとき、このカードを witness せよ。`,

      romaji: `Nagai kikan wa juu-ni seiki no ridge ni "sui" wo kizanda. Nitsurenai sora no shita, futatsu no silhouette wa chiisai—— suisei goi wa interval goi da. Sui wo mainichi minai. Mita toki, eien ni oboeru. Ruminara no ito ga ichiya turquoise de moeta. Ingrid no ito ga ue wo sashi, Jun no soukuu ga horizon wo seishi sase, Serafinu ga sui wo kisaki to narabe gin sennen no ledger ni archived shita.

SSR horizon go wa N rea drill dake ou shuushuuka ni mukuiru. Suisei wa kaeru—— kono yomi no hitsuyou mo mata kaeru.

Eiga de ichido dake arawarere, suunen haunt suru mare kanji no toki, kono kaado wo witness seyo.`,
    },
  },

  po_satoru: {
    originPlace: "The Meadow Gate Trail",
    originPlaceJa: "草原 gate の trail",
    whyItMatters:
      "Rafa greets 友 with open hands — friendship vocabulary starts at hello, not at chapter twelve.",
    whyItMattersJa:
      "ラファは「友」を開いた手で迎える——友情語彙は第十二章ではなく、挨拶から始まる。",
    mentions: ["po_flame", "po_aqua", "vo_luka"],
    body: {
      en: `Rafa waved 友 (tomo) along the Meadow Gate Trail, spark-tailed companion on his shoulder, because every adventure anime begins with someone willing to share the path. The Luminara Thread glinted in clover. Emberkit's flame-tail warmed the syllable; Tidepup splashed it in playful surf; Leo's kite fleet carried tomo across harbor wind without charging fare.

Pocket Listeners are beginner-friendly on purpose: tomo appears early, often, joyfully. Rafa refuses to let friendship kanji wait until you are advanced.

Start here when social vocabulary feels too formal. Friends say tomo before they say anything complicated.`,

      ja: `ラファは草原 gate の trail で「友」を振った。肩の spark-tail companion と共に——冒険アニメは道を分かち合う者から始まる。ルミナラの糸がクローバーで瞬いた。エンバーキットの炎尾が音节を温め、タイドパップが遊び surf で splash し、レオの凧船が harbor 風に友を運んだ—— fare は取らず。

 pocket 聞き手は初心者向けが purpose——友は早く、頻繁に、 joyfully 現れる。ラファは友情漢字を上級まで待たせない。

社交語彙が堅すぎるとき、ここから始めよ。友は複雑な何より先に言う。`,

      romaji: `Rafa wa sougen gate no trail de "tomo" wo futta. Kata no spark-tail companion to tomo ni—— bouken anime wa michi wo wakachiau mono kara hajimaru. Ruminara no ito ga kuroobaa de matataita. Enbaakitto no honoo-o ga ksetsu wo atatame, Taidopappu ga asobi surf de splash shi, Reo no takabune ga harbor kaze ni tomo wo hakonda—— fare wa torazu.

Pocket kikite wa shoshinsha-muki ga purpose—— tomo wa hayaku, hinfu ni, joyfully arawareru. Rafa wa yuujou kanji wo joukyuu made matasenai.

Shakou goi ga katasugiru toki, koko kara hajimeyo. Tomo wa fukuzatsu na nani yori saki ni iu.`,
    },
  },

  po_flame: {
    originPlace: "The Ember Meadow Ring",
    originPlaceJa: "余燼 meadow の ring",
    whyItMatters:
      "Emberkit kindles 火 — elemental pocket words burn in fast when you treat them like companions.",
    whyItMattersJa:
      "エンバーキットは「火」を灯す——元素 pocket 語は companion のように扱えば速く燃える。",
    mentions: ["sl_honoka", "po_legend", "ch_dragon"],
    body: {
      en: `Emberkit bounced 火 (hi) through the Ember Meadow Ring, flame-tipped tail leaving trails learners could chase like subtitles. Fire kanji are starter kanji — Devika's Svargathil hearth agreed from a distant cliff. Stormcrown roared rai on a thunder cliff; Nibbles puffed hi smaller, ridiculous, unforgettable.

Creature-collector decks teach through affection. Say hi to hi daily; let the fox-creature be your mnemonic.

Catch Emberkit when fire radicals blur together. One tail-flame at a time.`,

      ja: `エンバーキットは余燼 meadow の ring で「火」を bounce した。炎尾が subtitle のように追える trail を残す。火漢字は starter 漢字——遠い崖のデヴィカの炉も同意した。ストームクラウンが雷 cliff で咆哮し、ニブルズがもっと小さくばかげた hi を puff した——忘れられない。

 creature-collector deck は affection で教える。毎日 hi に hi を言え。 fox-creature を mnemonics にせよ。

火部が blur するとき、エンバーキットを catch せよ。一度に tail-flame 一つ。`,

      romaji: `Enbaakitto wa yojin meadow no ring de "hi" wo bounce shita. Honoo-o ga subtitle no you ni oeru trail wo nokosu. Hi kanji wa starter kanji—— tooi gake no Devika no ro mo doui shita. Sutormukuraun ga rai cliff de houkou shi, Niburuzu ga motto chiisaku bakageta hi wo puff shita—— wasurerarenai.

Creature-collector dekki wa affection de oshieru. Mainichi hi ni hi wo ie. Fox-creature wo mnemonics ni seyo.

Hi-bu ga blur suru toki, Enbaakitto wo catch seyo. Ichido ni tail-flame hitotsu.`,
    },
  },

  po_aqua: {
    originPlace: "The Shell Surf Shallows",
    originPlaceJa: "貝 surf の浅瀬",
    whyItMatters:
      "Tidepup rides 波 — water vocabulary sticks when you splash it before you analyze it.",
    whyItMattersJa:
      "タイドパップは「波」に乗る——水語彙は分析より先に splash すれば定着する。",
    mentions: ["sp_umi", "vo_nami", "he_bond"],
    body: {
      en: `Tidepup surfed 波 (nami) in the Shell Surf Shallows, seashell hat tilted, because water words should move. Kai's ocean altar echoed nami in deep register; Nami's tide-sense mapped the same syllable across pirate horizons; Biscuit dreamed yo-waves that arrived before the episode did.

R-rarity pocket companions bridge genres — nami appears in slice-of-life beaches and battle oceans alike. Tidepup asks you to read aloud near real water if you can.

Deploy when 氵 radicals multiply. Splash first; grammar later.`,

      ja: `タイドパップは貝 surf の浅瀬で「波」を surf した。貝帽が tilt——水の語は動くべきだ。カイの海 altar が深い register で波をこだまし、ナミの tide-sense が pirate horizon 全体に同音节を map し、ビスケットはエピソードより先に来る予波を夢見た。

 R レア pocket companion は genre を bridge——波は日常 beach にも battle 海にも現れる。タイドパップは可能なら本当の水辺で声に出せと求める。

氵部が増殖するとき deploy せよ。先に splash。後で grammar。`,

      romaji: `Taidopappu wa kai surf no asase de "nami" wo surf shita. Kaibou ga tilt—— mizu no go wa ugoku beki da. Kai no umi altar ga fukai register de nami wo kodama shi, Nami no tide-sense ga pirate horizon zentai ni onaji ksetsu wo map shi, Bisukeetto wa episoodo yori saki ni kuru yo-nami wo yumemita.

R rea pocket companion wa genre wo bridge—— nami wa nichijou beach ni mo battle umi ni mo arawareru. Taidopappu wa kanou nara hontou no mizube de koe ni dese to motomeru.

氵-bu ga zoufuku suru toki deploy seyo. Saki ni splash. Ato de grammar.`,
    },
  },

  po_legend: {
    originPlace: "The Thundercrown Cliff",
    originPlaceJa: "雷冠 cliff",
    whyItMatters:
      "Stormcrown roars 雷 — legendary vocabulary is loud, rare, and worth building toward.",
    whyItMattersJa:
      "ストームクラウンは「雷」を咆哮する——伝説語彙は loud で稀だが、目指す価値がある。",
    mentions: ["po_flame", "sp_ohtori", "sh_monarch"],
    body: {
      en: `Stormcrown crowned 雷 (rai) on the Thundercrown Cliff, lightning mane crackling, because SR pocket legends teach respect for loud kanji you cannot rush. Emberkit's hi warmed the base; Shiro's phoenix stage wrote rai in feather-fire across a concert sky; Ravindra's shadow army saluted the same syllable from a violet throne.

Legendary cards are milestones, not starters. Learners who collect Stormcrown have survived enough drills to hear rai without flinching.

Ascend when thunder arcs appear in openings — you are ready for the noise.`,

      ja: `ストームクラウンは雷冠 cliff で「雷」を戴いた。稲妻 mane が crackling—— SR pocket legend は rush できない loud 漢字への respect を教える。エンバーキットの火が base を温め、シロの phoenix stage が concert 空に羽火で雷を書き、ラヴィンドラの影軍が violet 玉座から同音节に salute した。

 legendary カードは milestone であり starter ではない。ストームクラウンを集めた学習者は、 flinch せず雷を聞けるだけ drill を生き延びた。

 opening の thunder arc のとき ascende せよ—— noise に ready だ。`,

      romaji: `Sutormukuraun wa raikan cliff de "rai" wo itadaita. Inazuma mane ga crackling—— SR pocket legend wa rush dekinai loud kanji e no respect wo oshieru. Enbaakitto no hi ga base wo atatame, Shiro no phoenix stage ga concert sora ni habi de rai wo kaki, Ravindra no kagegun ga violet gyokza kara onaji ksetsu ni salute shita.

Legendary kaado wa milestone de ari starter de wa nai. Sutormukuraun wo atsumeta gakushuusha wa, flinch sezu rai wo kikeru dake drill wo ikinobita.

Opening no thunder arc no toki ascende seyo—— noise ni ready da.`,
    },
  },

  sh_rookie: {
    originPlace: "The Grey Gate Cellar",
    originPlaceJa: "灰色 gate の cellar",
    whyItMatters:
      "Minjae starts with 影 — every hunter began at the lowest rank, and so did your deck.",
    whyItMattersJa:
      "ミンジェは「影」から始める—— hunter も deck も、最低 rank から始まった。",
    mentions: ["sh_ranger", "re_kuro", "ch_knight"],
    body: {
      en: `Minjae gripped 影 (kage) in the Grey Gate Cellar, scuffed jacket and plain dagger, blue-violet glow just beginning — shadow vocabulary is underdog vocabulary. The Luminara Thread flickered like a dungeon torch. Aditi drew yumi above a portal; Renji cut kage from moonlight once to prove shadows can bleed; Sir Pebble's cardboard shield reflected the same syllable without irony.

Korean action manhwa decks intimidate beginners. Minjae legitimizes starting at N-rarity: kage is small, kage is real, kage grows.

Keep him when comparison kills motivation.`,

      ja: `ミンジェは灰色 gate の cellar で「影」を握った。擦れた jacket、 plain dagger、始まったばかりの青紫 glow——影語彙は underdog 語彙だ。ルミナラの糸が dungeon torch のように flicker した。アディティが portal 上で弓を引き、レンジが一度月光から影を切って影も bleed すると証明し、サー・ペブルの段ボール盾が irony なしに同音节を反射した。

韓国 action manhwa deck は初心者を intimidate する。ミンジェは N レア開始を正当化する——影は小さい、影は real、影は grow する。

 comparison が motivation を殺すとき、彼を keep せよ。`,

      romaji: `Minje wa haiiro gate no cellar de "kage" wo nigitta. Szureta jacket, plain dagger, hajimatta bakari no aomurasaki glow—— kage goi wa underdog goi da. Ruminara no ito ga dungeon torch no you ni flicker shita. Aditi ga portal jou de yumi wo hiki, Renji ga ichido gekkou kara kage wo kitte kage mo bleed suru to shoumei shi, Saa Peburu no danbouru tate ga irony nashi ni onaji ksetsu wo hansha shita.

Kankoku action manhwa dekki wa shoshinsha wo intimidate suru. Minje wa N rea kaishi wo seitouka suru—— kage wa chiisai, kage wa real, kage wa grow suru.

Comparison ga motivation wo korosu toki, kare wo keep seyo.`,
    },
  },

  sh_ranger: {
    originPlace: "The Violet Portal Range",
    originPlaceJa: "紫 portal の range",
    whyItMatters:
      "Aditi draws 弓 — ranged vocabulary hits targets you cannot reach with melee memorization alone.",
    whyItMattersJa:
      "アディティは「弓」を引く——射程語彙は近接暗記だけでは届かない標的に命中する。",
    mentions: ["sh_rookie", "vo_zoro", "ti_grim"],
    body: {
      en: `Aditi drew 弓 (yumi) across the Violet Portal Range, bow of crackling energy, because some readings require distance — you aim, release, trust the arc. Minjae's kage glowed below as anchor; Roronoa's three-sword rhythm cut yumi from another tradition entirely; Zola's grim register measured the same syllable in frost.

Guild rangers guard gate vocabulary: terms that appear when characters enter new zones. Aditi trains spatial memory — where yumi sits in a sentence, not just on a chart.

Equip her when dungeon arc jargon floods subtitles.`,

      ja: `アディティは紫 portal の range で「弓」を引いた。 crackling energy の弓——ある読みは distance が要る。 aim し、 release し、 arc を trust せ。下でミンジェの影 glow が anchor となり、ロロノアの三刀 rhythm が別 tradition から弓を切り、ゾーラの grim register が霜の中で同音节を測った。

 guild ranger は gate 語彙を guard——キャラが新 zone に入るとき現れる語。アディティは spatial memory を鍛える——弓が chart だけでなく文のどこに座るか。

 dungeon arc jargon が subtitle を flood するとき、彼女を equip せよ。`,

      romaji: `Aditi wa murasaki portal no range de "yumi" wo hiita. Crackling energy no yumi—— aru yomi wa distance ga iru. Aim shi, release shi, arc wo trust se. Shita de Minje no kage glow ga anchor to nari, Roronoa no santou rhythm ga betsu tradition kara yumi wo kiri, Zora no grim register ga shimo no naka de onaji ksetsu wo hakatta.

Guild ranger wa gate goi wo guard—— kyara ga shin zone ni hairu toki arawareru go. Aditi wa spatial memory wo kitaeru—— yumi ga chart dake de naku bun no doko ni suwaru ka.

Dungeon arc jargon ga subtitle wo flood suru toki, kanojo wo equip seyo.`,
    },
  },

  sh_knight: {
    originPlace: "The Summoner's Blue Circle",
    originPlaceJa: "召喚者の青 circle",
    whyItMatters:
      "Tomas shields 盾 — defensive vocabulary protects your core words when battle arcs get dense.",
    whyItMattersJa:
      "トマスは「盾」を掲げる——防御語彙は battle arc が dense になるとき core 語を守る。",
    mentions: ["cu_maki", "sh_monarch", "he_yor"],
    body: {
      en: `Tomas knelt with 盾 (tate) in the Summoner's Blue Circle, spectral armor wreathed in violet flame — a shadow-knight guards the words his summoner cannot yet say. Priya's glaive had carved ha in a training track; Ravindra's monarch shadows pressed against the shield without cracking it; Leyla's thorn kitchen taught that protection and danger share a ladle.

SR shadow knights appear mid-journey. tate is for learners drowning in attack vocabulary who forgot to memorize defense, block, guard, shield.

Summon him when boss-rush subtitles overwhelm.`,

      ja: `トマスは召喚者の青 circle で「盾」と kneel した。 violet flame の spectral armor—— shadow-knight は summoner がまだ言えない語を guard する。プリヤの薙刀が training track で刃を刻み、ラヴィンドラの monarch 影が盾を押しても crack せず、レイラの茨 kitchen が保護と危険は同じおたまを分かつと教えた。

 SR shadow knight は mid-journey に現れる。盾は attack 語彙に溺れ、防御・ block ・ guard ・ shield の暗記を忘れた学習者のため。

 boss-rush subtitle が overwhelm するとき、彼を summon せよ。`,

      romaji: `Tomasu wa shoukan sha no ao circle de "tate" to kneel shita. Violet flame no spectral armor—— shadow-knight wa summoner ga mada ienai go wo guard suru. Puriya no naginata ga training track de ha wo kizami, Ravindra no monarch kage ga tate wo oshite mo crack sezu, Reira no ibara kitchen ga hogo to kiken wa onaji otama wo wakatsu to oshiete.

SR shadow knight wa mid-journey ni arawareru. Tate wa attack goi ni obore, bougyo, block, guard, shield no anki wo wasureta gakushuusha no tame.

Boss-rush subtitle ga overwhelm suru toki, kare wo summon seyo.`,
    },
  },

  sh_monarch: {
    originPlace: "The Violet Throne of Ashgate",
    originPlaceJa: "アッシュ gate 紫 throne",
    whyItMatters:
      "Ravindra commands 王 — monarch vocabulary is endgame fluency, earned after hundreds of honest reviews.",
    whyItMattersJa:
      "ラヴィンドラは「王」を統べる——王語彙は endgame 流暢さであり、数百の誠実な復習の後に得られる。",
    mentions: ["sh_rookie", "ne_titan", "vo_yonko"],
    body: {
      en: `Ravindra ascended 王 (ou) on the Violet Throne of Ashgate, shadow soldiers rising like archived flashcards finally promoted. Monarch is not arrogance — it is the rank you earn when kage becomes army. Minjae's first glow answered from the cellar; Bruna's hagane could not cut ou, only name it; Olamide laughed from pirate sea, calling every king a captain of synonyms.

SSR shadow capstones reward decade learners. ou appears rarely, lands heavily — treat this card as graduation, not hype.

Crown him when your deck stops feeling like homework and starts feeling like command.`,

      ja: `ラヴィンドラはアッシュ gate 紫 throne で「王」に ascended した。 shadow soldiers が promoted された archived flashcard のように rise。 monarch は arrogance ではない——影が army になったとき earn する rank だ。 cellar からミンジェの最初の glow が応え、ブルーナの鋼は王を切れず name だけした。オラミデが pirate 海から笑い、王は皆同義語の captain だと言った。

 SSR shadow capstone は decade 学習者に報いる。王は稀に現れ、 heavy に land—— hype ではなく graduation としてこのカードを treat せよ。

 deck が homework ではなく command に感じるとき、crown せよ。`,

      romaji: `Ravindra wa Asshu gate murasaki throne de "ou" ni ascended shita. Shadow soldiers ga promoted sareta archived furasshukaado no you ni rise. Monarch wa arrogance de wa nai—— kage ga army ni natta toki earn suru rank da. Cellar kara Minje no saisho no glow ga kotae, Buruuna no hagane wa ou wo kirezu name dake shita. Olamide ga pirate umi kara warai, ou wa mina dougigo no captain da to itta.

SSR shadow capstone wa decade gakushuusha ni mukuiru. Ou wa mare ni arawarere, heavy ni land—— hype de wa naku graduation to shite kono kaado wo treat seyo.

Dekki ga homework de wa naku command ni kanjiru toki, crown seyo.`,
    },
  },

  ch_mocha: {
    originPlace: "The Riceball Roundhouse",
    originPlaceJa: "おにぎり roundhouse",
    whyItMatters:
      "Mochi snacks on 豆 — tiny words matter because chibi decks teach without intimidation.",
    whyItMattersJa:
      "モチは「豆」を snack する—— chibi deck は intimidate せずに教えるから、小さな語が重要だ。",
    mentions: ["ch_pud", "sp_totomi", "ps_dimple"],
    body: {
      en: `Mochi hugged 豆 (mame) in the Riceball Roundhouse, cowlick bouncing, because the smallest Listener holds the smallest kanji — and mame unlocks more compounds than its size suggests. Totomi's shrine path crossed the Thread with festival beans; Blip orbited teal smugness around the riceball; Flan stacked sweet mame beside pudding towers.

Chibi style exists so beginners never fear the deck. Mochi is level-one proof: one honest bean-word beats fifty scared skips.

Start your collection here if anime feels too heavy.`,

      ja: `モチはおにぎり roundhouse で「豆」を hug した。 cowlick bouncing——最小の聞き手が最小漢字を抱える。mame は size 以上の compound を unlock する。トトミの shrine path が festival 豆で糸を cross し、ブリップが teal の得意げさをおにぎりの周りを orbit し、フランが pud 塔の傍に甘い豆を stack した。

 chibi style は初心者が deck を恐れないためにある。モチは level-one 証明—— honest 一 bean-word が scared skip 五十に勝つ。

 anime が heavy に感じるなら、 collection をここから start せよ。`,

      romaji: `Mochi wa onigiri roundhouse de "mame" wo hug shita. Cowlick bouncing—— saishou no kikite ga saishou kanji wo daite iru. Mame wa size ijou no compound wo unlock suru. Totomi no shrine path ga festival mame de ito wo cross shi, Burippu ga teal no tokuige-sa wo onigiri no mawari wo orbit shi, Furan ga pud tou no hata de amai mame wo stack shita.

Chibi style wa shoshinsha ga dekki wo osore nai tame ni aru. Mochi wa level-one shoumei—— honest ich bean-word ga scared skip gojuu ni katsu.

Anime ga heavy ni kanjiru nara, collection wo koko kara start seyo.`,
    },
  },

  ch_pud: {
    originPlace: "The Wobbly Dango Tower",
    originPlaceJa: "揺れる dango tower",
    whyItMatters:
      "Flan balances 甘 — sweet vocabulary is valid study, especially when joy keeps you returning.",
    whyItMattersJa:
      "フランは「甘」を均衡させる—— sweet 語彙も valid な study で、 joy が戻ってくる理由になる。",
    mentions: ["ch_mocha", "lu_venus", "he_anya"],
    body: {
      en: `Flan stacked 甘 (ama) in the Wobbly Dango Tower, tongue out, cat ears twitching — dessert kanji deserve the same respect as battle kanji when they keep you studying. Camila chained ama to beni-adjacent love readings; Pip giggled ama at breakfast beside biscuits; Mochi shared bean-sweet overlap without competing.

Chibi dessert Listeners fight burnout. ama is not frivolous — it is the flavor of reward after drills.

Collect Flan when your streak dies of seriousness.`,

      ja: `フランは揺れる dango tower で「甘」を stack した。舌を出し、猫耳 twitch—— dessert 漢字は study を続けさせるなら battle 漢字と同じ respect を deserve する。カミラが甘を beni 隣接の love reading に鎖し、ピップがビスケットの傍で朝 ama を giggled し、モチが competing せず bean-sweet overlap を分かち合った。

 chibi dessert 聞き手は burnout と戦う。甘は frivolous ではない—— drill 後の reward の flavor だ。

 seriousness で streak が死ぬとき、フランを collect せよ。`,

      romaji: `Furan wa yureru dango tower de "ama" wo stack shita. Shita wo dashi, nekomimi twitch—— dessert kanji wa study wo tsuzukase ru nara battle kanji to onaji respect wo deserve suru. Kamira ga ama wo beni rinsetsu no love reading ni kusashi, Pippu ga bisukeetto no hata de asa ama wo giggled shi, Mochi ga competing sezu bean-sweet overlap wo wakachia tta.

Chibi dessert kikite wa burnout to tatakau. Ama wa frivolous de wa nai—— drill ato no reward no flavor da.

Seriousness de streak ga shinu toki, Furan wo collect seyo.`,
    },
  },

  ch_knight: {
    originPlace: "The Cardboard Coliseum",
    originPlaceJa: "段ボール coliseum",
    whyItMatters:
      "Sir Pebble proves 勇 fits in pocket armor — courage vocabulary is not size, it is practice.",
    whyItMattersJa:
      "サー・ペブルは「勇」が pocket armor に fit することを証明する——勇気語彙は大きさではなく practice だ。",
    mentions: ["sh_rookie", "he_yor", "ch_dragon"],
    body: {
      en: `Sir Pebble raised 勇 (yuu) in the Cardboard Coliseum, pot-lid shield high, wooden sword straight — the pocket hero teaches that bravery kanji belong to beginners too. Minjae's cellar glow answered; Leyla's thorn kitchen nodded; Nibbles puffed smoke that spelled yuu in dragon puff, cheering the tiny knight.

R-rarity chibi courage is deliberate: yuu appears in shounen speeches you will quote before you parse. Pebble is permission to feel heroic at level twenty-five.

Deploy when intimidation blocks loud subtitle chants.`,

      ja: `サー・ペブルは段ボール coliseum で「勇」を掲げた。 pot-lid shield high、木剣 straight—— pocket hero は brave 漢字も初心者のものだと教える。ミンジェの cellar glow が応え、レイラの茨 kitchen が nod し、ニブルズが dragon puff で yuu を綴る煙を puff し、 tiny knight を cheer した。

 R レア chibi courage は deliberate——勇は parse より先に quote する shounen speech に現れる。ペブルは level 二十五で heroic に feel していいという permission だ。

 intimidation が loud subtitle chant を block するとき deploy せよ。`,

      romaji: `Saa Peburu wa danbouru coliseum de "yuu" wo kagegeta. Pot-lid shield high, bokken straight—— pocket hero wa brave kanji mo shoshinsha no mono da to oshieru. Minje no cellar glow ga kotae, Reira no ibara kitchen ga nod shi, Niburuzu ga dragon puff de yuu wo tsuzuru kemuri wo puff shi, tiny knight wo cheer shita.

R rea chibi courage wa deliberate—— yuu wa parse yori saki ni quote suru shounen speech ni arawareru. Peburu wa level nijuugo de heroic ni feel shite ii to iu permission da.

Intimidation ga loud subtitle chant wo block suru toki, deploy seyo.`,
    },
  },

  ch_dragon: {
    originPlace: "The Single-Coin Hoard",
    originPlaceJa: "一枚 coin の hoard",
    whyItMatters:
      "Nibbles hoards 竜 — even the smallest dragon card teaches that mythic readings start somewhere humble.",
    whyItMattersJa:
      "ニブルズは「竜」を hoard する——最小 dragon カードでも、神話的読みは humble な所から始まると教える。",
    mentions: ["po_flame", "he_bond", "ch_mocha"],
    body: {
      en: `Nibbles puffed 竜 (ryuu) on the Single-Coin Hoard, stubby wings, smoke ring perfect — world's smallest dragon, largest myth kanji taught gentle. Emberkit's hi warmed the coin; Biscuit dreamed ryuu arriving before subtitles rolled; Mochi clapped without understanding scale, which is exactly how learners should start.

SR chibi dragons are punchlines that stick. ryuu compounds flood fantasy decks — Nibbles makes the first one cute enough to remember.

Hatch him when dragon radicals terrify you. Small smoke, big recall.`,

      ja: `ニブルズは一枚 coin の hoard で「竜」を puff した。 stubby wings、完璧な smoke ring——世界最小 dragon、最大 myth 漢字を gentle に教えた。エンバーキットの火が coin を温め、ビスケットは subtitle が roll する前に竜が来る夢を見、モチは scale を理解せず clap した——学習者が start すべきまさにその姿。

 SR chibi dragon は stick する punchline。竜 compound は fantasy deck を flood——ニブルズは最初の一つを cute enough にして remember させる。

 dragon 部が terrify するとき hatch せよ。 small smoke、 big recall。`,

      romaji: `Niburuzu wa ichimai coin no hoard de "ryuu" wo puff shita. Stubby wings, kanpeki na smoke ring—— sekai saishou dragon, saidai myth kanji wo gentle ni oshieta. Enbaakitto no hi ga coin wo atatame, Bisukeetto wa subtitle ga roll suru mae ni ryuu ga kuru yume wo mi, Mochi wa scale wo rikai sezu clap shita—— gakushuusha ga start subeki masani sono sugata.

SR chibi dragon wa stick suru punchline. Ryuu compound wa fantasy dekki wo flood—— Niburuzu wa saisho no hitotsu wo cute enough ni shite remember sase ru.

Dragon-bu ga terrify suru toki hatch seyo. Small smoke, big recall.`,
    },
  },
};
