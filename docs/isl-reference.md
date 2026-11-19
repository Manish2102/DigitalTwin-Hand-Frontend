# Indian Sign Language (ISL) reference

This is every sign the [Sign language](sign-language.md) section recognises, with a picture and a short
description of how it is made. **Nothing here is drawn or written by hand:** for each sign, the most typical recording
in the training data (the one closest to the average of all recordings of that sign) is drawn as a skeleton, and the
description is measured from the same recording: how many hands, the hand shape (which fingers are straight), where the
sign is made, which way the hand moves, and whether the movement repeats.

**Reading the pictures.** You see the signer facing you, as on a video call, so the signer's **right hand (blue)** is on
the **left** of the picture and the left hand (orange) on the right. A grey hand is resting. Word signs show the start,
middle and end of the movement, with the path of each wrist dashed on the middle figure and an arrow at its end.
Letters and numbers show the whole person and, beside it, an enlarged view of the hands.

**Accuracy** is how often the app recognised that sign correctly in recordings it was not trained on (words: INCLUDE's
test videos; letters and numbers: adult signers, while training used kids and teenagers). A blank means too few test
recordings.

**Learning ISL.** These pictures are a reminder, not a course. To learn signs properly, use the video dictionary of the
[Indian Sign Language Research and Training Centre (ISLRTC)](https://islrtc.nic.in/) and learn from Deaf signers.
Signs vary between regions; the word signs here were recorded in Chennai.

Sources: words from **INCLUDE** (Sridhar, Ganesan, Kumar, Khapra; AI4Bharat and IIT Madras; ACM Multimedia 2020),
[zenodo.org/records/4010759](https://zenodo.org/records/4010759), CC BY 4.0. Letters and numbers from **Static gestures
of Indian Sign Language (ISL) for English Alphabet, Hindi Vowels and Numerals**, Mendeley Data,
[doi 10.17632/7tsw22y96w.1](https://data.mendeley.com/datasets/7tsw22y96w), CC BY 4.0. The pictures and descriptions
are derived from these datasets (landmarks only) and are shared under the same licence.

## Contents

- [Overview and accuracy](#overview-and-accuracy)
- [Fingerspelling: letters A to Z](#fingerspelling:-letters-a-to-z)
- [Numbers 0 to 9](#numbers-0-to-9)
- [Greetings and everyday expressions](#greetings-and-everyday-expressions)
- [Pronouns](#pronouns)
- [People and family](#people-and-family)
- [Days and time](#days-and-time)
- [Places](#places)
- [Society](#society)
- [Questions](#questions)
- [Phrases and sentences](#phrases-and-sentences)
- [Signs that look alike](#signs-that-look-alike)
- [What is not supported yet](#what-is-not-supported-yet)

## Overview and accuracy

| | Signs | Correct on first guess | Right answer in top 3 | When it answers |
|---|---|---|---|---|
| Words | 106 | 87 % of 335 test videos | 94 % | answers 84 % of the time, and is right 94 % of those times |
| Letters and numbers | 36 | 81 % of 2055 single images of unseen signers | 95 % | single images: answers 43 %, right 95 %; live, letters are held for half a second, which makes it answer far more often |

When it is not sure, the app says so and shows its best three guesses instead of writing a wrong word.

## Fingerspelling: letters A to Z

ISL fingerspelling mostly uses **both hands**. Hold each letter still for about half a second; lower your hands to end a word. E has two common forms in the dataset; both are recognised. H, J and Y involve movement, but the dataset records their final position, which is what the app recognises.

| Sign | Picture | How it is made | Accuracy |
|---|---|---|---|
| **A** | <img src="isl/letter-a.svg" width="240" alt="ISL sign A"> | Two hands. Right hand: thumb and index and middle and ring extended, at chest level. Left hand: fist with the thumb out, at waist level. | 84 % |
| **B** | <img src="isl/letter-b.svg" width="240" alt="ISL sign B"> | Two hands. Right hand: closed fist, at chest level. Left hand: little finger raised, at chest level. | 100 % |
| **C** | <img src="isl/letter-c.svg" width="240" alt="ISL sign C"> | One hand. Right hand: L shape (thumb and index), at chest level. | 75 % |
| **D** | <img src="isl/letter-d.svg" width="240" alt="ISL sign D"> | Two hands. Right hand: index finger pointing, at chest level. Left hand: index finger pointing, at chest level. | 42 % |
| **E** | <img src="isl/letter-e.svg" width="240" alt="ISL sign E"> | One hand. Right hand: index finger pointing, at waist level. | 66 % |
| **F** | <img src="isl/letter-f.svg" width="240" alt="ISL sign F"> | Two hands. Right hand: thumb and index and middle extended, at chest level. Left hand: thumb and index and middle extended, at chest level. | 85 % |
| **G** | <img src="isl/letter-g.svg" width="240" alt="ISL sign G"> | Two hands. Right hand: fist with the thumb out, at chest level. Left hand: fist with the thumb out, at waist level. | 86 % |
| **H** | <img src="isl/letter-h.svg" width="240" alt="ISL sign H"> | One hand. Left hand: flat hand, thumb folded, at waist level. | 78 % |
| **I** | <img src="isl/letter-i.svg" width="240" alt="ISL sign I"> | One hand. Right hand: index finger pointing, at chest level. | 84 % |
| **J** | <img src="isl/letter-j.svg" width="240" alt="ISL sign J"> | Two hands. Right hand: index finger pointing, at chest level. Left hand: L shape (thumb and index), at waist level. | 90 % |
| **K** | <img src="isl/letter-k.svg" width="240" alt="ISL sign K"> | Two hands. Right hand: fist with the thumb out, at chest level. Left hand: index finger pointing, at waist level. | 90 % |
| **L** | <img src="isl/letter-l.svg" width="240" alt="ISL sign L"> | One hand. Right hand: L shape (thumb and index), at chest level. | 78 % |
| **M** | <img src="isl/letter-m.svg" width="240" alt="ISL sign M"> | Two hands. Right hand: flat hand, thumb folded, at waist level. Left hand: open flat hand, at chest level. The hands touch or overlap. | 50 % |
| **N** | <img src="isl/letter-n.svg" width="240" alt="ISL sign N"> | Two hands. Right hand: index finger pointing, at waist level. Left hand: flat hand, thumb folded, at chest level. | 59 % |
| **O** | <img src="isl/letter-o.svg" width="240" alt="ISL sign O"> | One hand. Right hand: closed fist, at chest level. | 56 % |
| **P** | <img src="isl/letter-p.svg" width="240" alt="ISL sign P"> | Two hands. Right hand: index finger pointing, at chest level. Left hand: L shape (thumb and index), at waist level. | 100 % |
| **Q** | <img src="isl/letter-q.svg" width="240" alt="ISL sign Q"> | Two hands. Right hand: L shape (thumb and index), at waist level. Left hand: closed fist, at chest level. | 95 % |
| **R** | <img src="isl/letter-r.svg" width="240" alt="ISL sign R"> | One hand. Left hand: flat hand, thumb folded, at chest level. | 92 % |
| **S** | <img src="isl/letter-s.svg" width="240" alt="ISL sign S"> | Two hands. Right hand: closed fist, at waist level. Left hand: fist with the thumb out, at chest level. | 89 % |
| **T** | <img src="isl/letter-t.svg" width="240" alt="ISL sign T"> | Two hands. Right hand: index finger pointing, at chest level. Left hand: index finger pointing, at waist level. | 38 % |
| **U** | <img src="isl/letter-u.svg" width="240" alt="ISL sign U"> | One hand. Right hand: L shape (thumb and index), at waist level. | 78 % |
| **V** | <img src="isl/letter-v.svg" width="240" alt="ISL sign V"> | One hand. Right hand: index and middle finger (V), at chest level. | 73 % |
| **W** | <img src="isl/letter-w.svg" width="240" alt="ISL sign W"> | Two hands. Right hand: flat hand, thumb folded, at chest level. Left hand: open flat hand, at chest level. | 93 % |
| **X** | <img src="isl/letter-x.svg" width="240" alt="ISL sign X"> | Two hands. Right hand: L shape (thumb and index), at chest level. Left hand: L shape (thumb and index), at waist level. | 47 % |
| **Y** | <img src="isl/letter-y.svg" width="240" alt="ISL sign Y"> | One hand. Right hand: index finger pointing, at chest level. | 81 % |
| **Z** | <img src="isl/letter-z.svg" width="240" alt="ISL sign Z"> | Two hands. Right hand: flat hand, thumb folded, at chest level. Left hand: open flat hand, at chest level. | 96 % |

## Numbers 0 to 9

Numbers are mostly one hand. **0 and the letter O share one hand shape**: the app writes 0 after another digit and O otherwise. 9 has two common forms in the dataset; both are recognised.

| Sign | Picture | How it is made | Accuracy |
|---|---|---|---|
| **0** | <img src="isl/letter-0.svg" width="240" alt="ISL sign 0"> | One hand. Right hand: closed fist, at chest level. | 63 % |
| **1** | <img src="isl/letter-1.svg" width="240" alt="ISL sign 1"> | One hand. Right hand: index finger pointing, at chest level. | 90 % |
| **2** | <img src="isl/letter-2.svg" width="240" alt="ISL sign 2"> | One hand. Right hand: index and middle finger (V), at chest level. | 89 % |
| **3** | <img src="isl/letter-3.svg" width="240" alt="ISL sign 3"> | One hand. Right hand: index and middle and ring extended, at chest level. | 96 % |
| **4** | <img src="isl/letter-4.svg" width="240" alt="ISL sign 4"> | One hand. Right hand: flat hand, thumb folded, at chest level. | 100 % |
| **5** | <img src="isl/letter-5.svg" width="240" alt="ISL sign 5"> | One hand. Right hand: open flat hand, at chest level. | 100 % |
| **6** | <img src="isl/letter-6.svg" width="240" alt="ISL sign 6"> | One hand. Right hand: little finger raised, at chest level. | 100 % |
| **7** | <img src="isl/letter-7.svg" width="240" alt="ISL sign 7"> | One hand. Right hand: index finger pointing, at chest level. | 94 % |
| **8** | <img src="isl/letter-8.svg" width="240" alt="ISL sign 8"> | One hand. Right hand: thumb and index and middle extended, at chest level. | 81 % |
| **9** | <img src="isl/letter-9.svg" width="240" alt="ISL sign 9"> | One hand. Right hand: fist with the thumb out, at chest level. | 100 % |

## Greetings and everyday expressions

| Sign | Picture | How it is made | Accuracy |
|---|---|---|---|
| **Alright** | <img src="isl/word-alright.svg" width="340" alt="ISL sign Alright"> | Two hands. Right hand: thumb and little finger out (Y), at chest level, moves and comes back. Left hand: fist with the thumb out, at chest level, moves downwards. | 75 % |
| **Good afternoon** | <img src="isl/word-good-afternoon.svg" width="340" alt="ISL sign Good afternoon"> | One hand (the signer's right); the other hand rests. Right hand: flat hand, thumb folded, at chest level, moves towards the signer's left. | 100 % |
| **Good evening** | <img src="isl/word-good-evening.svg" width="340" alt="ISL sign Good evening"> | One hand (the signer's right); the other hand rests. Right hand: flat hand, thumb folded, at chest level, moves towards the signer's right, repeated. | 57 % |
| **Good Morning** | <img src="isl/word-good-morning.svg" width="340" alt="ISL sign Good Morning"> | One hand (the signer's right); the other hand rests. Right hand: middle and ring and little extended, at chest level, moves upwards. | 100 % |
| **Good night** | <img src="isl/word-good-night.svg" width="340" alt="ISL sign Good night"> | One hand (the signer's right); the other hand rests. Right hand: thumb and middle and ring and little extended, at chest level, moves downwards. | 75 % |
| **Hello** | <img src="isl/word-hello.svg" width="340" alt="ISL sign Hello"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves and comes back. | 100 % |
| **How are you** | <img src="isl/word-how-are-you.svg" width="340" alt="ISL sign How are you"> | Two hands. Right hand: open flat hand, at chest level, moves downwards, repeated. Left hand: thumb and middle and ring and little extended, at chest level, moves and comes back, repeated. | 100 % |
| **Pleased** | <img src="isl/word-pleased.svg" width="340" alt="ISL sign Pleased"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves upwards. | 100 % |
| **Thank you** | <img src="isl/word-thank-you.svg" width="340" alt="ISL sign Thank you"> | Two hands. Right hand: open flat hand, at chest level, moves downwards. Left hand: open flat hand, at chest level, moves downwards. | 100 % |

## Pronouns

| Sign | Picture | How it is made | Accuracy |
|---|---|---|---|
| **he** | <img src="isl/word-he.svg" width="340" alt="ISL sign he"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves downwards. | 75 % |
| **I** | <img src="isl/word-i.svg" width="340" alt="ISL sign I"> | One hand (the signer's right); the other hand rests. Right hand: fist with the thumb out, at chest level, stays in place. | 100 % |
| **it** | <img src="isl/word-it.svg" width="340" alt="ISL sign it"> | One hand (the signer's right); the other hand rests. Right hand: index finger pointing, at waist level, moves downwards. | 100 % |
| **she** | <img src="isl/word-she.svg" width="340" alt="ISL sign she"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves towards the signer's right. | 75 % |
| **they** | <img src="isl/word-they.svg" width="340" alt="ISL sign they"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, near the face, moves towards the signer's right and downwards, repeated. | 100 % |
| **we** | <img src="isl/word-we.svg" width="340" alt="ISL sign we"> | Two hands. Right hand: flat hand, thumb folded, at chest level, moves towards the signer's left and downwards. Left hand: thumb and ring and little extended, at chest level, moves towards the signer's right and upwards. | 50 % |
| **you** | <img src="isl/word-you.svg" width="340" alt="ISL sign you"> | One hand (the signer's right); the other hand rests. Right hand: L shape (thumb and index), at chest level, stays in place. | 100 % |
| **you (plural)** | <img src="isl/word-you-plural.svg" width="340" alt="ISL sign you (plural)"> | One hand (the signer's right); the other hand rests. Right hand: index finger pointing, at chest level, moves towards the signer's right. | 100 % |

## People and family

| Sign | Picture | How it is made | Accuracy |
|---|---|---|---|
| **Adult** | <img src="isl/word-adult.svg" width="340" alt="ISL sign Adult"> | One hand (the signer's right); the other hand rests. Right hand: index and middle finger (V), at chest level, moves towards the signer's right and upwards. | 100 % |
| **Baby** | <img src="isl/word-baby.svg" width="340" alt="ISL sign Baby"> | Two hands. Right hand: open flat hand, at chest level, moves and comes back. Left hand: flat hand, thumb folded, at waist level, moves and comes back. | 50 % |
| **Boy** | <img src="isl/word-boy.svg" width="340" alt="ISL sign Boy"> | One hand (the signer's right); the other hand rests. Right hand: flat hand, thumb folded, at chest level, moves towards the signer's right. | 75 % |
| **Brother** | <img src="isl/word-brother.svg" width="340" alt="ISL sign Brother"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves towards the signer's left. | 75 % |
| **Child** | <img src="isl/word-child.svg" width="340" alt="ISL sign Child"> | One hand (the signer's right); the other hand rests. Right hand: closed fist, at chest level, stays in place. | 75 % |
| **Crowd** | <img src="isl/word-crowd.svg" width="340" alt="ISL sign Crowd"> | Two hands. Right hand: open flat hand, at chest level, stays in place. Left hand: thumb and index and middle extended, at chest level, moves and comes back. | 100 % |
| **Daughter** | <img src="isl/word-daughter.svg" width="340" alt="ISL sign Daughter"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves downwards. | 75 % |
| **Family** | <img src="isl/word-family.svg" width="340" alt="ISL sign Family"> | Two hands. Right hand: index and middle finger (V), at waist level, moves and comes back. Left hand: index and middle finger (V), at waist level, moves and comes back. | 100 % |
| **Father** | <img src="isl/word-father.svg" width="340" alt="ISL sign Father"> | Two hands. Right hand: index and middle finger (V), at chest level, moves downwards. Left hand: index and middle finger (V), at chest level, moves upwards. | 50 % |
| **Friend** | <img src="isl/word-friend.svg" width="340" alt="ISL sign Friend"> | One hand (the signer's right); the other hand rests. Right hand: thumb and index and middle and ring extended, at chest level, stays in place. | 67 % |
| **Girl** | <img src="isl/word-girl.svg" width="340" alt="ISL sign Girl"> | One hand (the signer's right); the other hand rests. Right hand: index finger pointing, at chest level, moves towards the signer's right and downwards. | 100 % |
| **Grandfather** | <img src="isl/word-grandfather.svg" width="340" alt="ISL sign Grandfather"> | Two hands. Right hand: open flat hand, at chest level, moves downwards, repeated. Left hand: closed fist, at waist level, moves towards the signer's right. | 100 % |
| **Grandmother** | <img src="isl/word-grandmother.svg" width="340" alt="ISL sign Grandmother"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves downwards. | 100 % |
| **Husband** | <img src="isl/word-husband.svg" width="340" alt="ISL sign Husband"> | Two hands. Right hand: flat hand, thumb folded, at chest level, moves downwards. Left hand: flat hand, thumb folded, at chest level, stays in place. | 100 % |
| **King** | <img src="isl/word-king.svg" width="340" alt="ISL sign King"> | One hand (the signer's right); the other hand rests. Right hand: flat hand, thumb folded, near the face, moves upwards. | 100 % |
| **Man** | <img src="isl/word-man.svg" width="340" alt="ISL sign Man"> | One hand (the signer's right); the other hand rests. Right hand: closed fist, at chest level, moves and comes back. | 100 % |
| **Mother** | <img src="isl/word-mother.svg" width="340" alt="ISL sign Mother"> | One hand (the signer's right); the other hand rests. Right hand: closed fist, at chest level, stays in place. | 100 % |
| **Neighbour** | <img src="isl/word-neighbour.svg" width="340" alt="ISL sign Neighbour"> | Two hands. Right hand: open flat hand, at chest level, moves downwards. Left hand: open flat hand, at chest level, moves downwards. | 75 % |
| **Parent** | <img src="isl/word-parent.svg" width="340" alt="ISL sign Parent"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves and comes back. | 100 % |
| **Player** | <img src="isl/word-player.svg" width="340" alt="ISL sign Player"> | One hand (the signer's right); the other hand rests. Right hand: L shape (thumb and index), at chest level, moves and comes back. | 100 % |
| **President** | <img src="isl/word-president.svg" width="340" alt="ISL sign President"> | Two hands. Right hand: fist with the thumb out, at chest level, moves towards the signer's left and downwards. Left hand: open flat hand, at chest level, moves and comes back. | 100 % |
| **Queen** | <img src="isl/word-queen.svg" width="340" alt="ISL sign Queen"> | One hand (the signer's right); the other hand rests. Right hand: flat hand, thumb folded, near the face, moves upwards. | 100 % |
| **Sister** | <img src="isl/word-sister.svg" width="340" alt="ISL sign Sister"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves towards the signer's left and downwards. | 50 % |
| **Son** | <img src="isl/word-son.svg" width="340" alt="ISL sign Son"> | Two hands. Right hand: flat hand, thumb folded, at chest level, moves downwards. Left hand: flat hand, thumb folded, at waist level, stays in place. | 100 % |
| **Wife** | <img src="isl/word-wife.svg" width="340" alt="ISL sign Wife"> | Two hands. Right hand: flat hand, thumb folded, at chest level, moves downwards. Left hand: open flat hand, at chest level, stays in place. | 25 % |
| **Woman** | <img src="isl/word-woman.svg" width="340" alt="ISL sign Woman"> | One hand (the signer's right); the other hand rests. Right hand: index finger pointing, at chest level, stays in place. | 100 % |

## Days and time

| Sign | Picture | How it is made | Accuracy |
|---|---|---|---|
| **Afternoon** | <img src="isl/word-afternoon.svg" width="340" alt="ISL sign Afternoon"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, near the face, moves and comes back. | 100 % |
| **Evening** | <img src="isl/word-evening.svg" width="340" alt="ISL sign Evening"> | One hand (the signer's right); the other hand rests. Right hand: index and middle and ring extended, at chest level, moves towards the signer's right. | 0 % |
| **Friday** | <img src="isl/word-friday.svg" width="340" alt="ISL sign Friday"> | One hand (the signer's right); the other hand rests. Right hand: closed fist, at chest level, stays in place. | 100 % |
| **Hour** | <img src="isl/word-hour.svg" width="340" alt="ISL sign Hour"> | Two hands. Right hand: fist with the thumb out, at chest level, moves towards the signer's right and downwards. Left hand: closed fist, at waist level, moves and comes back. | 100 % |
| **Minute** | <img src="isl/word-minute.svg" width="340" alt="ISL sign Minute"> | One hand (the signer's right); the other hand rests. Right hand: L shape (thumb and index), at chest level, stays in place. | 100 % |
| **Monday** | <img src="isl/word-monday.svg" width="340" alt="ISL sign Monday"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves and comes back. | 0 % |
| **Month** | <img src="isl/word-month.svg" width="340" alt="ISL sign Month"> | Two hands. Right hand: fist with the thumb out, at chest level, moves and comes back. Left hand: open flat hand, at chest level, stays in place. | 100 % |
| **Morning** | <img src="isl/word-morning.svg" width="340" alt="ISL sign Morning"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves and comes back. | 100 % |
| **Night** | <img src="isl/word-night.svg" width="340" alt="ISL sign Night"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, stays in place. | 100 % |
| **Saturday** | <img src="isl/word-saturday.svg" width="340" alt="ISL sign Saturday"> | One hand (the signer's right); the other hand rests. Right hand: thumb and index and middle extended, at chest level, moves and comes back. | 100 % |
| **Second** | <img src="isl/word-second.svg" width="340" alt="ISL sign Second"> | One hand (the signer's right); the other hand rests. Right hand: index finger pointing, at chest level, stays in place. | 100 % |
| **Sunday** | <img src="isl/word-sunday.svg" width="340" alt="ISL sign Sunday"> | One hand (the signer's right); the other hand rests. Right hand: fist with the thumb out, at chest level, stays in place. | 100 % |
| **Thursday** | <img src="isl/word-thursday.svg" width="340" alt="ISL sign Thursday"> | One hand (the signer's right); the other hand rests. Right hand: L shape (thumb and index), at chest level, moves and comes back. | 0 % |
| **Time** | <img src="isl/word-time.svg" width="340" alt="ISL sign Time"> | Two hands. Right hand: index finger pointing, at chest level, stays in place. Left hand: closed fist, at chest level, moves upwards. | 100 % |
| **Today** | <img src="isl/word-today.svg" width="340" alt="ISL sign Today"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves downwards. |  |
| **Tomorrow** | <img src="isl/word-tomorrow.svg" width="340" alt="ISL sign Tomorrow"> | One hand (the signer's right); the other hand rests. Right hand: closed fist, at chest level, moves downwards. | 100 % |
| **Tuesday** | <img src="isl/word-tuesday.svg" width="340" alt="ISL sign Tuesday"> | One hand (the signer's right); the other hand rests. Right hand: closed fist, at chest level, moves and comes back. | 100 % |
| **Wednesday** | <img src="isl/word-wednesday.svg" width="340" alt="ISL sign Wednesday"> | Two hands. Right hand: open flat hand, at chest level, moves upwards. Left hand: open flat hand, at chest level, moves and comes back. | 100 % |
| **Week** | <img src="isl/word-week.svg" width="340" alt="ISL sign Week"> | Two hands. Right hand: flat hand, thumb folded, at chest level, moves and comes back. Left hand: open flat hand, at chest level, stays in place. | 100 % |
| **Year** | <img src="isl/word-year.svg" width="340" alt="ISL sign Year"> | Two hands. Right hand: thumb and middle and ring and little extended, at chest level, moves downwards. Left hand: flat hand, thumb folded, at chest level, moves and comes back. | 100 % |
| **Yesterday** | <img src="isl/word-yesterday.svg" width="340" alt="ISL sign Yesterday"> | One hand (the signer's right); the other hand rests. Right hand: index finger pointing, at chest level, moves and comes back. | 100 % |

## Places

| Sign | Picture | How it is made | Accuracy |
|---|---|---|---|
| **Bank** | <img src="isl/word-bank.svg" width="340" alt="ISL sign Bank"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves and comes back. | 100 % |
| **City** | <img src="isl/word-city.svg" width="340" alt="ISL sign City"> | One hand (the signer's right); the other hand rests. Right hand: middle and ring and little extended, at chest level, moves and comes back. | 100 % |
| **Court** | <img src="isl/word-court.svg" width="340" alt="ISL sign Court"> | Two hands. Right hand: thumb and index and middle extended, at chest level, moves and comes back. Left hand: thumb and index and middle extended, at chest level, moves downwards. | 100 % |
| **Ground** | <img src="isl/word-ground.svg" width="340" alt="ISL sign Ground"> | Two hands. Right hand: index and middle finger (V), at chest level, moves and comes back. Left hand: thumb and index and middle extended, at chest level, moves and comes back. | 100 % |
| **Hospital** | <img src="isl/word-hospital.svg" width="340" alt="ISL sign Hospital"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, moves towards the signer's right and upwards. | 100 % |
| **House** | <img src="isl/word-house.svg" width="340" alt="ISL sign House"> | Two hands. Right hand: open flat hand, at chest level, moves towards the signer's right and downwards. Left hand: open flat hand, at chest level, moves and comes back. | 75 % |
| **India** | <img src="isl/word-india.svg" width="340" alt="ISL sign India"> | One hand (the signer's right); the other hand rests. Right hand: closed fist, near the face, moves upwards. | 100 % |
| **Library** | <img src="isl/word-library.svg" width="340" alt="ISL sign Library"> | One hand (the signer's right); the other hand rests. Right hand: flat hand, thumb folded, at chest level, moves and comes back, repeated. | 25 % |
| **Location** | <img src="isl/word-location.svg" width="340" alt="ISL sign Location"> | One hand (the signer's right); the other hand rests. Right hand: thumb and index and little extended, at chest level, moves and comes back. | 100 % |
| **Market** | <img src="isl/word-market.svg" width="340" alt="ISL sign Market"> | Two hands. Right hand: thumb and index and middle and ring extended, at chest level, moves and comes back. Left hand: open flat hand, at chest level, moves and comes back. | 67 % |
| **Office** | <img src="isl/word-office.svg" width="340" alt="ISL sign Office"> | One hand (the signer's right); the other hand rests. Right hand: middle and ring and little extended, at chest level, moves and comes back. | 100 % |
| **Park** | <img src="isl/word-park.svg" width="340" alt="ISL sign Park"> | Two hands. Right hand: L shape (thumb and index), at chest level, moves and comes back, repeated. Left hand: L shape (thumb and index), at chest level, moves downwards. | 100 % |
| **Restaurant** | <img src="isl/word-restaurant.svg" width="340" alt="ISL sign Restaurant"> | One hand (the signer's right); the other hand rests. Right hand: thumb and ring and little extended, at chest level, stays in place. | 75 % |
| **School** | <img src="isl/word-school.svg" width="340" alt="ISL sign School"> | Two hands. Right hand: open flat hand, at chest level, moves upwards. Left hand: open flat hand, at chest level, moves and comes back. | 100 % |
| **Store or Shop** | <img src="isl/word-store-or-shop.svg" width="340" alt="ISL sign Store or Shop"> | One hand (the signer's right); the other hand rests. Right hand: flat hand, thumb folded, at waist level, stays in place. | 50 % |
| **Street or Road** | <img src="isl/word-street-or-road.svg" width="340" alt="ISL sign Street or Road"> | One hand (the signer's left); the other hand rests. Left hand: index finger pointing, at waist level, moves and comes back. | 50 % |
| **Temple** | <img src="isl/word-temple.svg" width="340" alt="ISL sign Temple"> | Two hands. Right hand: fist with the thumb out, at chest level, moves towards the signer's right and downwards. Left hand: closed fist, at chest level, moves upwards. | 100 % |
| **Train Station** | <img src="isl/word-train-station.svg" width="340" alt="ISL sign Train Station"> | Two hands. Right hand: open flat hand, at chest level, moves towards the signer's right and downwards, repeated. Left hand: index finger pointing, at waist level, moves downwards. | 75 % |
| **University** | <img src="isl/word-university.svg" width="340" alt="ISL sign University"> | One hand (the signer's right); the other hand rests. Right hand: L shape (thumb and index), at chest level, moves and comes back. | 75 % |

## Society

| Sign | Picture | How it is made | Accuracy |
|---|---|---|---|
| **Attack** | <img src="isl/word-attack.svg" width="340" alt="ISL sign Attack"> | One hand (the signer's right); the other hand rests. Right hand: index finger pointing, at chest level, moves towards the signer's left and upwards. | 100 % |
| **Ball** | <img src="isl/word-ball.svg" width="340" alt="ISL sign Ball"> | One hand (the signer's right); the other hand rests. Right hand: open flat hand, at chest level, stays in place. | 100 % |
| **Bill** | <img src="isl/word-bill.svg" width="340" alt="ISL sign Bill"> | Two hands. Right hand: flat hand, thumb folded, at chest level, moves downwards. Left hand: flat hand, thumb folded, at chest level, moves downwards. | 0 % |
| **Death** | <img src="isl/word-death.svg" width="340" alt="ISL sign Death"> | Two hands. Right hand: open flat hand, at chest level, moves towards the signer's right and downwards, repeated. Left hand: open flat hand, at chest level, moves towards the signer's right. | 67 % |
| **Election** | <img src="isl/word-election.svg" width="340" alt="ISL sign Election"> | Two hands. Right hand: open flat hand, at chest level, moves downwards, repeated. Left hand: open flat hand, at chest level, moves and comes back. | 100 % |
| **Energy** | <img src="isl/word-energy.svg" width="340" alt="ISL sign Energy"> | Two hands. Right hand: closed fist, at chest level, stays in place. Left hand: closed fist, at chest level, moves downwards. | 100 % |
| **Exercise** | <img src="isl/word-exercise.svg" width="340" alt="ISL sign Exercise"> | Two hands. Right hand: closed fist, at chest level, moves and comes back, repeated. Left hand: closed fist, at chest level, moves towards the signer's right. | 100 % |
| **God** | <img src="isl/word-god.svg" width="340" alt="ISL sign God"> | Two hands. Right hand: fist with the thumb out, at chest level, moves and comes back. Left hand: fist with the thumb out, at chest level, moves towards the signer's left and downwards. | 100 % |
| **Gun** | <img src="isl/word-gun.svg" width="340" alt="ISL sign Gun"> | One hand (the signer's right); the other hand rests. Right hand: thumb and index and middle extended, at chest level, stays in place. | 100 % |
| **Marriage** | <img src="isl/word-marriage.svg" width="340" alt="ISL sign Marriage"> | Two hands. Right hand: flat hand, thumb folded, at chest level, moves downwards. Left hand: flat hand, thumb folded, at chest level, moves downwards. | 67 % |
| **Medicine** | <img src="isl/word-medicine.svg" width="340" alt="ISL sign Medicine"> | Two hands. Right hand: thumb and index and middle extended, at chest level, moves towards the signer's right and downwards. Left hand: index and ring and little extended, at chest level, moves towards the signer's left. | 100 % |
| **Money** | <img src="isl/word-money.svg" width="340" alt="ISL sign Money"> | One hand (the signer's right); the other hand rests. Right hand: fist with the thumb out, at chest level, stays in place. | 100 % |
| **Newspaper** | <img src="isl/word-newspaper.svg" width="340" alt="ISL sign Newspaper"> | Two hands. Right hand: open flat hand, at chest level, moves and comes back. Left hand: index and middle finger (V), at chest level, moves towards the signer's left. | 100 % |
| **Peace** | <img src="isl/word-peace.svg" width="340" alt="ISL sign Peace"> | Two hands. Right hand: open flat hand, at chest level, moves downwards. Left hand: open flat hand, at chest level, moves towards the signer's left. | 100 % |
| **Price** | <img src="isl/word-price.svg" width="340" alt="ISL sign Price"> | One hand (the signer's right); the other hand rests. Right hand: closed fist, at chest level, moves towards the signer's right and downwards. | 100 % |
| **Race (ethnicity)** | <img src="isl/word-race-ethnicity.svg" width="340" alt="ISL sign Race (ethnicity)"> | Two hands. Right hand: fist with the thumb out, at chest level, moves and comes back, repeated. Left hand: fist with the thumb out, at chest level, moves downwards, repeated. | 33 % |
| **Religion** | <img src="isl/word-religion.svg" width="340" alt="ISL sign Religion"> | One hand (the signer's right); the other hand rests. Right hand: flat hand, thumb folded, at chest level, moves towards the signer's right and downwards. | 100 % |
| **Science** | <img src="isl/word-science.svg" width="340" alt="ISL sign Science"> | Two hands. Right hand: fist with the thumb out, at chest level, moves downwards, repeated. Left hand: index finger pointing, at chest level, moves towards the signer's left and downwards, repeated. | 100 % |
| **Sign** | <img src="isl/word-sign.svg" width="340" alt="ISL sign Sign"> | One hand (the signer's right); the other hand rests. Right hand: L shape (thumb and index), at chest level, moves towards the signer's right and downwards, repeated. | 100 % |
| **Sport** | <img src="isl/word-sport.svg" width="340" alt="ISL sign Sport"> | Two hands. Right hand: index and middle finger (V), at chest level, moves towards the signer's right and downwards, repeated. Left hand: thumb and index and middle extended, at chest level, moves towards the signer's left and downwards, repeated. | 100 % |
| **Team** | <img src="isl/word-team.svg" width="340" alt="ISL sign Team"> | Two hands. Right hand: closed fist, at chest level, moves and comes back. Left hand: index finger pointing, at chest level, moves upwards. | 100 % |
| **Technology** | <img src="isl/word-technology.svg" width="340" alt="ISL sign Technology"> | Two hands. Right hand: open flat hand, at chest level, moves and comes back. Left hand: open flat hand, at chest level, stays in place. | 100 % |
| **War** | <img src="isl/word-war.svg" width="340" alt="ISL sign War"> | Two hands. Right hand: flat hand, thumb folded, at chest level, moves towards the signer's left. Left hand: flat hand, thumb folded, at chest level, moves towards the signer's right. | 100 % |

## Questions

The vocabulary has one question sign, **HOW ARE YOU** (see Greetings). In ISL, questions are mostly marked with the face
(raised or lowered eyebrows) and with question signs such as WHAT, WHERE and WHY. The app does not read facial expressions
and these question signs are not in the trained vocabulary yet, so it cannot tell a question from a statement. A question
mark is not added automatically.

## Phrases and sentences

The app recognises **one sign at a time** and writes the signs in the order they were made (ISL gloss order). You can sign
these sequences with a short rest (hands down) between signs. The English line is the usual meaning; ISL grammar also uses
space, direction and facial expression, which the app does not read, and the app does not translate the gloss into English.

| Sign sequence (one sign at a time) | Usual meaning |
|---|---|
| HELLO + HOW ARE YOU | Hello, how are you? |
| GOOD MORNING + THANK YOU | Good morning, thank you. |
| I + PLEASED | I am pleased. |
| YOU + FRIEND | You are a friend. |
| MOTHER + FATHER + HOUSE | Mother and father are at home. |
| TOMORROW + I + SCHOOL | Tomorrow I go to school. |
| TODAY + MONDAY | Today is Monday. |
| FRIEND + HOSPITAL + TODAY | A friend is in hospital today. |
| BROTHER + OFFICE + EVENING | Brother is at the office in the evening. |
| WE + MARKET + SATURDAY | We go to the market on Saturday. |

## Signs that look alike

These pairs were confused most often in the test recordings. Make the difference clear (hand shape, place, movement) and, if the app shows *Not sure*, tap the right suggestion.

| Signed | Sometimes read as | Times |
|---|---|---|
| Good evening | Good night | 3 |
| Wife | Husband | 2 |
| Street or Road | Today | 2 |
| Race (ethnicity) | Court | 2 |
| we | Week | 1 |
| we | Daughter | 1 |
| she | he | 1 |
| he | she | 1 |
| X | E | 23 |
| D | X | 22 |
| T | K | 18 |
| O | 0 | 16 |
| M | N | 16 |
| 0 | O | 15 |
| T | E | 14 |
| N | R | 13 |

## What is not supported yet

- Words outside the list above (INCLUDE has 263 signs in 15 categories; six categories are used so far), continuous signing
  without a rest between signs, facial expressions and mouthing, ISL grammar (space, direction, classifier signs), Hindi
  vowels in the fingerspelling dataset, and two-person conversations.
- More vocabulary can be added by extracting more INCLUDE categories and retraining (see [sign-language.md](sign-language.md)).
