import React, { Suspense, useEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useTexture, Loader, Environment, useFBX, useAnimations, OrthographicCamera } from '@react-three/drei';
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial';

import { LinearEncoding, sRGBEncoding } from 'three/src/constants';
import { LineBasicMaterial, MeshPhysicalMaterial, Vector2 } from 'three';
import ReactAudioPlayer from 'react-audio-player';

import { OrbitControls } from '@react-three/drei';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import createAnimation from './converter';
import blinkData from './blendDataBlink.json';

import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Access your API key (see "Set up your API key" above)
import './App.css'

import * as THREE from 'three';
import axios from 'axios';
const _ = require('lodash');

const host = 'https://talking-avatar.onrender.com'

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_BARD_API_KEY);
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
  area: { position: 'absolute', bottom: '0', left: '0', zIndex: 500 },
  speak: { padding: '5px', display: 'block', color: '#FFFFFF', background: '#222222', border: 'None' },
  label: { color: '#777777', fontSize: '0.5em' },
}

function App() {

  const [chats, setChats] = useState([{ msg: 'Hi there! How can I assist you today?', who: 'bot', exct: '0' }])
  const [text, setText] = useState("Hello I am joi, your 3D virtual assistant.");
  const [msg, setMsg] = useState("");
  const [exct, setexct] = useState("");
  const [load, setLoad] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [visits, setVisits] = useState("--");
  const getResposnse = async (msg) => {
    if (msg === '') {
      toast.error("Promt can't be empty.[In some browsers mic may not work]");
      return;
    }
    if (load === true || speak === true) {
      toast.error("Already generating response!");
      return;
    }
    setChats(chats => [...chats, { msg: msg, who: 'me' }])

    setMsg("");
    setLoad(true);
    var requestOptions = {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en',
        'Content-Type': 'application/json',
      },
    };
  
    const start = new Date();
    const model = genAI.getGenerativeModel({ model: "gemini-pro"});

    const prompt = "Generate short response for this prompt : " + msg 

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const timeTaken = (new Date()) - start;
    const text = response.text();
    setSpeak(true);
    setText(text);
    setexct(timeTaken / 1000);
    setLoad(false)
    
  }

  const getWebsiteVisits = async () => {
    const url = 'https://counter10.p.rapidapi.com/?ID=prompt3&COLOR=red&CLABEL=blue';
    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': 'ede3c5163fmsh01abdacf07fd2b0p1c0e4bjsn1db1b15be576',
        'X-RapidAPI-Host': 'counter10.p.rapidapi.com'
      }
    };
    try {
      const response = await fetch(url, options);
      const result = await response.text();
      console.log(result);

      setVisits(JSON.parse(result).message)
    } catch (error) {
      console.error(error);
    }
  }
  useEffect(() => {
    getWebsiteVisits();
  }, [])
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
        <button style={STYLES.speak}>
          {speak || load ? 'Running...' : 'Type message.'}
        </button>
      </div>
      <div className='about' onClick={() => { setShowModal(!showModal) }}>
        <img src='./images/icons/menu.png' alt='menu'></img>
      </div>
      <div className='modal' style={{ display: showModal ? 'flex' : 'none' }}>
        <h1>Promt 3D</h1>
        <p style={{ marginTop: '10px' }}>A ThreeJS-powered virtual human that uses chatGPT and Azure APIs to do some face talking</p>
        <a style={{ padding: '10px' }} className='repo' href='https://github.com/vaibhav1663/promt3d' target='_blank'>Github</a>
        <p>Made with ❤️ by</p>
        <a href='https://vaibhav1663.github.io/' target='_blank' style={{ marginBlock: "5px" }}>Vaibhav Khating</a>
        <p>Visitor's count 👀 : <span style={{color: '#35a4f3'}}>{visits}</span></p>
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

          {(load == true || speak) && !playing ? <p style={{ padding: '5px', display: 'flex', alignItems: 'center' }}><lottie-player src="https://lottie.host/8891318b-7fd9-471d-a9f4-e1358fd65cd6/EQt3MHyLWk.json" style={{ width: "50px", height: "50px" }} loop autoplay speed="1.4" direction="1" mode="normal"></lottie-player></p> : <></>}
        </div>
        <div className='msg-box'>
          <button className='msgbtn' id='mic' onTouchStart={startListening} onMouseDown={startListening} onTouchEnd={stopListening} onMouseUp={stopListening}>
            <img src='./images/icons/mic.png' alt='mic' unselectable='on'></img>
          </button>
          <input type='text' value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { getResposnse(msg) } }} placeholder='Say Hello!'></input>
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
          zoom={1400}
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

  const texture = useTexture('/images/background.jpg');

  return (
    <mesh position={[0, 1.5, -4]} scale={[1.2, 1.2, 1.2]}>
      <planeBufferGeometry />
      <meshBasicMaterial map={texture} />

    </mesh>
  )

}

export default App;
