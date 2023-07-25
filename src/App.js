import React, { Suspense, useEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useTexture, Loader, Environment, useFBX, useAnimations, OrthographicCamera } from '@react-three/drei';
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial';

import { LinearEncoding, sRGBEncoding } from 'three/src/constants';
import { LineBasicMaterial, MeshPhysicalMaterial, Vector2 } from 'three';
import ReactAudioPlayer from 'react-audio-player';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import createAnimation from './converter';
import blinkData from './blendDataBlink.json';

import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

import './App.css'

import * as THREE from 'three';
import axios from 'axios';
const _ = require('lodash');

const host = 'https://talking-avatar.onrender.com'

function Avatar({ avatar_url, speak, setSpeak, text, setAudioSource, playing }) {

  let gltf = useGLTF(avatar_url);
  let morphTargetDictionaryBody = null;
  let morphTargetDictionaryLowerTeeth = null;

  const [
    bodyTexture,
    eyesTexture,
    teethTexture,
    bodySpecularTexture,
    bodyRoughnessTexture,
    bodyNormalTexture,
    teethNormalTexture,
    // teethSpecularTexture,
    hairTexture,
    tshirtDiffuseTexture,
    tshirtNormalTexture,
    tshirtRoughnessTexture,
    hairAlphaTexture,
    hairNormalTexture,
    hairRoughnessTexture,
  ] = useTexture([
    "/images/body.webp",
    "/images/eyes.webp",
    "/images/teeth_diffuse.webp",
    "/images/body_specular.webp",
    "/images/body_roughness.webp",
    "/images/body_normal.webp",
    "/images/teeth_normal.webp",
    // "/images/teeth_specular.webp",
    "/images/h_color.webp",
    "/images/tshirt_diffuse.webp",
    "/images/tshirt_normal.webp",
    "/images/tshirt_roughness.webp",
    "/images/h_alpha.webp",
    "/images/h_normal.webp",
    "/images/h_roughness.webp",
  ]);

  _.each([
    bodyTexture,
    eyesTexture,
    teethTexture,
    teethNormalTexture,
    bodySpecularTexture,
    bodyRoughnessTexture,
    bodyNormalTexture,
    tshirtDiffuseTexture,
    tshirtNormalTexture,
    tshirtRoughnessTexture,
    hairAlphaTexture,
    hairNormalTexture,
    hairRoughnessTexture
  ], t => {
    t.encoding = sRGBEncoding;
    t.flipY = false;
  });

  bodyNormalTexture.encoding = LinearEncoding;
  tshirtNormalTexture.encoding = LinearEncoding;
  teethNormalTexture.encoding = LinearEncoding;
  hairNormalTexture.encoding = LinearEncoding;


  gltf.scene.traverse(node => {


    if (node.type === 'Mesh' || node.type === 'LineSegments' || node.type === 'SkinnedMesh') {

      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;


      if (node.name.includes("Body")) {

        node.castShadow = true;
        node.receiveShadow = true;

        node.material = new MeshPhysicalMaterial();
        node.material.map = bodyTexture;
        // node.material.shininess = 60;
        node.material.roughness = 1.7;

        // node.material.specularMap = bodySpecularTexture;
        node.material.roughnessMap = bodyRoughnessTexture;
        node.material.normalMap = bodyNormalTexture;
        node.material.normalScale = new Vector2(0.6, 0.6);

        morphTargetDictionaryBody = node.morphTargetDictionary;

        node.material.envMapIntensity = 0.8;
        // node.material.visible = false;

      }

      if (node.name.includes("Eyes")) {
        node.material = new MeshStandardMaterial();
        node.material.map = eyesTexture;
        // node.material.shininess = 100;
        node.material.roughness = 0.1;
        node.material.envMapIntensity = 0.5;


      }

      if (node.name.includes("Brows")) {
        node.material = new LineBasicMaterial({ color: 0x000000 });
        node.material.linewidth = 1;
        node.material.opacity = 0.5;
        node.material.transparent = true;
        node.visible = false;
      }

      if (node.name.includes("Teeth")) {

        node.receiveShadow = true;
        node.castShadow = true;
        node.material = new MeshStandardMaterial();
        node.material.roughness = 0.1;
        node.material.map = teethTexture;
        node.material.normalMap = teethNormalTexture;

        node.material.envMapIntensity = 0.7;


      }

      if (node.name.includes("Hair")) {
        node.material = new MeshStandardMaterial();
        node.material.map = hairTexture;
        node.material.alphaMap = hairAlphaTexture;
        node.material.normalMap = hairNormalTexture;
        node.material.roughnessMap = hairRoughnessTexture;

        node.material.transparent = true;
        node.material.depthWrite = false;
        node.material.side = 2;
        node.material.color.setHex(0x000000);

        node.material.envMapIntensity = 0.3;


      }

      if (node.name.includes("TSHIRT")) {
        node.material = new MeshStandardMaterial();

        node.material.map = tshirtDiffuseTexture;
        node.material.roughnessMap = tshirtRoughnessTexture;
        node.material.normalMap = tshirtNormalTexture;
        node.material.color.setHex(0xffffff);

        node.material.envMapIntensity = 0.5;


      }

      if (node.name.includes("TeethLower")) {
        morphTargetDictionaryLowerTeeth = node.morphTargetDictionary;
      }

    }

  });

  const [clips, setClips] = useState([]);
  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), []);

  useEffect(() => {

    if (speak === false)
      return;

    makeSpeech(text)
      .then(response => {

        let { blendData, filename } = response.data;
        console.log(filename);
        let newClips = [
          createAnimation(blendData, morphTargetDictionaryBody, 'HG_Body'),
          createAnimation(blendData, morphTargetDictionaryLowerTeeth, 'HG_TeethLower')];

        filename = host + filename;

        setClips(newClips);
        setAudioSource(filename);

      })
      .catch(err => {
        console.error(err);
        setSpeak(false);

      })

  }, [speak]);

  let idleFbx = useFBX('/idle.fbx');
  let { clips: idleClips } = useAnimations(idleFbx.animations);

  idleClips[0].tracks = _.filter(idleClips[0].tracks, track => {
    return track.name.includes("Head") || track.name.includes("Neck") || track.name.includes("Spine2");
  });

  idleClips[0].tracks = _.map(idleClips[0].tracks, track => {

    if (track.name.includes("Head")) {
      track.name = "head.quaternion";
    }

    if (track.name.includes("Neck")) {
      track.name = "neck.quaternion";
    }

    if (track.name.includes("Spine")) {
      track.name = "spine2.quaternion";
    }

    return track;

  });

  useEffect(() => {

    let idleClipAction = mixer.clipAction(idleClips[0]);
    idleClipAction.play();

    let blinkClip = createAnimation(blinkData, morphTargetDictionaryBody, 'HG_Body');
    let blinkAction = mixer.clipAction(blinkClip);
    blinkAction.play();


  }, []);

  // Play animation clips when available
  useEffect(() => {

    if (playing === false)
      return;

    _.each(clips, clip => {
      let clipAction = mixer.clipAction(clip);
      clipAction.setLoop(THREE.LoopOnce);
      clipAction.play();

    });

  }, [playing]);


  useFrame((state, delta) => {
    mixer.update(delta);
  });

  return (
    <group name="avatar">
      <primitive object={gltf.scene} dispose={null} />
    </group>
  );
}


function makeSpeech(text) {
  return axios.post(host + '/talk', { text });
}

const STYLES = {
  area: { position: 'absolute', bottom: '10px', left: '10px', zIndex: 500 },
  text: { margin: '0px', width: '300px', padding: '5px', background: 'none', color: '#ffffff', fontSize: '1.2em', border: 'none' },
  speak: { padding: '10px', marginTop: '5px', display: 'block', color: '#FFFFFF', background: '#222222', border: 'None' },
  area2: { position: 'absolute', top: '5px', right: '15px', zIndex: 500 },
  label: { color: '#777777', fontSize: '0.8em' },
}

function App() {

  const [chats, setChats] = useState([{ msg: 'Hello', who: 'bot', exct: '0' }, { msg: 'Hey', who: 'me' }])
  const [text, setText] = useState("Hello I am joi, your 3D virtual assistant.");
  const [msg, setMsg] = useState("");
  const [exct, setexct] = useState("");
  const [load, setLoad] = useState(false);
  const getResposnse = (msg) => {
    if (msg === '') {
      toast.error("Promt can't be empty.[In some browsers mic may not work]");
      return;
    }
    if (load === true || speak === true) {
      toast.error("Already generating response!");
      return;
    }
    setChats(chats => [...chats, { msg: msg, who: 'me' }])

    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    setMsg("");
    setLoad(true);
    var raw = JSON.stringify({
      "model": "gpt-3.5-turbo",
      "messages": [
        {
          "role": "user",
          "content": "Hello"
        },
        {
          "role": "assistant",
          "content": "Hi there! How can I assist you today?"
        },
        {
          "role": "user",
          "content": "generate all responses shorter than 100 words"
        },
        {
          "role": "assistant",
          "content": "Sure, I can provide responses that are shorter than 100 words. Feel free to ask any questions or provide prompts!"
        },{
          "role": 'user',
          "content": ""+msg
        }
      ],
      "stream": false
    });
    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };
    const start = new Date();
    fetch("https://fakell.raidghost.com/v1/chat/completions/", requestOptions)
      .then(res => res.text())
      .then(response => JSON.parse(response))
      .then(result => {
        console.log(result);
        const timeTaken = (new Date()) - start;
        setSpeak(true);
        setText("" + result.choices[0].message.content);
        setexct(timeTaken/1000);
        setLoad(false)
      })
      .catch((error) => { alert('error: ', error.message); setLoad(false) });
  }
  useEffect(() => {
    document.querySelector('.chat-box').scrollTop = document.querySelector('.chat-box').scrollHeight;
  }, [chats])

  const audioPlayer = useRef();

  const [speak, setSpeak] = useState(false);
  const [audioSource, setAudioSource] = useState(null);
  const [playing, setPlaying] = useState(false);
  // End of play
  function playerEnded(e) {
    setAudioSource(null);
    setSpeak(false);
    setPlaying(false);
  }

  // Player is read
  function playerReady(e) {
    audioPlayer.current.audioEl.current.play();
    setPlaying(true);
    setChats(chats => [...chats, { msg: text, who: 'bot', exct: exct }]);

  }
  const {
    transcript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();
  const startListening = () => {
    if (browserSupportsSpeechRecognition) {
      SpeechRecognition.startListening()
    }
    else {
      toast.error("Voice recognision not supported by browser.")
    }

  };
  const stopListening = () => {
    getResposnse(msg);
    SpeechRecognition.stopListening();
  }

  useEffect(() => {
    setMsg(transcript);
  }, [transcript])

  return (
    <div className="full">
      <ToastContainer
        position="top-left"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      <div style={STYLES.area}>
        <button style={STYLES.speak}> {speak ? 'Running...' : 'Speak'}</button>
      </div>
      <div className='chat-div'>
        <div className='chat-box'>
          {chats.map((chat) => {
            if (chat.who === "me") {
              return <p className={chat.who}>
                {chat.msg}
              </p>
            } else {
              return <p className={chat.who}>
                {chat.msg}
                <div className='time'>{"generated in " + chat.exct + "s"}</div>
              </p>
            }
          })}
        </div>
        <div className='msg-box'>
          <button className='msgbtn' id='mic' onTouchStart={startListening} onMouseDown={startListening} onTouchEnd={stopListening} onMouseUp={stopListening}>
            <img src='./images/icons/mic.png' alt='mic' unselectable='on'></img>
          </button>
          <input type='text' value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' ? getResposnse(msg) : console.log("empty text")} placeholder='Say Hello!'></input>
          <button className='msgbtn' id='send' onClick={() => { getResposnse(msg) }}>
            <img src='./images/icons/send.png' alt='mic'></img>
          </button>
        </div>
      </div>
      <ReactAudioPlayer
        src={audioSource}
        ref={audioPlayer}
        onEnded={playerEnded}
        onCanPlayThrough={playerReady}

      />

      {/* <Stats /> */}
      <Canvas dpr={2} onCreated={(ctx) => {
        ctx.gl.physicallyCorrectLights = true;
      }}>

        <OrthographicCamera
          makeDefault
          zoom={2000}
          position={[0, 1.65, 1]}
        />

        {/* <OrbitControls
        target={[0, 1.65, 0]}
      /> */}

        <Suspense fallback={null}>
          <Environment background={false} files="/images/photo_studio_loft_hall_1k.hdr" />
        </Suspense>

        <Suspense fallback={null}>
          <Bg />
        </Suspense>

        <Suspense fallback={null}>
          <Avatar
            avatar_url="/model.glb"
            speak={speak}
            setSpeak={setSpeak}
            text={text}
            setAudioSource={setAudioSource}
            playing={playing}
          />
        </Suspense>
      </Canvas>
      <Loader dataInterpolation={(p) => `Loading... please wait`} />
    </div>
  )
}

function Bg() {

  const texture = useTexture('/images/bg.webp');

  return (
    <mesh position={[0, 1.5, -2]} scale={[0.8, 0.8, 0.8]}>
      <planeBufferGeometry />
      <meshBasicMaterial map={texture} />

    </mesh>
  )

}

export default App;
