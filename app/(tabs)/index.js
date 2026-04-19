import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Pressable,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";

const { width, height } = Dimensions.get("window");

const BIRD_SIZE = 42;
const PIPE_WIDTH = 75;
const GAP = 190;

const GRAVITY = 0.45;
const JUMP = -9.5;
const PIPE_SPEED = 3.8;

export default function Index() {
  const [birdY, setBirdY] = useState(height / 2);
  const [velocity, setVelocity] = useState(0);
  const [pipes, setPipes] = useState([{ x: width, height: 180 }]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const frame = useRef(null);
  const scoredPipes = useRef(new Set());

  const jumpSound = useRef(null);
  const hitSound = useRef(null);

  const tilt = useRef(new Animated.Value(0)).current;

  // =========================
  // 🎵 LOAD SOUNDS
  // =========================
  useEffect(() => {
    const init = async () => {
      try {
        const jump = new Audio.Sound();
        const hit = new Audio.Sound();

        await jump.loadAsync(require("../assets/jump.mp3"));
        await hit.loadAsync(require("../assets/hit.mp3"));

        jumpSound.current = jump;
        hitSound.current = hit;
      } catch (e) {
        console.log("Sound load error:", e);
      }
    };

    const loadHigh = async () => {
      const saved = await AsyncStorage.getItem("highScore");
      if (saved) setHighScore(Number(saved));
    };

    init();
    loadHigh();
  }, []);

  // =========================
  // 🔊 SAFE SOUND PLAYER
  // =========================
  const playSoundSafe = async (soundRef) => {
    try {
      if (!soundRef?.current) return;

      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;

      await soundRef.current.replayAsync();
    } catch (e) {
      console.log("Sound safe blocked:", e);
    }
  };

  // =========================
  // 🎮 GAME LOOP
  // =========================
  useEffect(() => {
    const loop = () => {
      if (!gameOver) {
        setVelocity(v => v + GRAVITY);
        setBirdY(y => y + velocity);

        setPipes(prev =>
          prev
            .map(p => ({ ...p, x: p.x - PIPE_SPEED }))
            .filter(p => p.x > -PIPE_WIDTH)
        );

        spawnPipe();
        checkCollision();

        tilt.setValue(velocity * 2);
      }

      frame.current = requestAnimationFrame(loop);
    };

    frame.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame.current);
  }, [velocity, birdY, gameOver]);

  // =========================
  // 🟩 SPAWN PIPE
  // =========================
  const spawnPipe = () => {
    setPipes(prev => {
      const last = prev[prev.length - 1];
      if (last.x < width - 200) {
        return [
          ...prev,
          {
            x: width,
            height: 120 + Math.random() * 240,
          },
        ];
      }
      return prev;
    });
  };

  // =========================
  // 💀 COLLISION CHECK
  // =========================
  const checkCollision = async () => {
    for (let p of pipes) {
      const hitX =
        width / 2 + BIRD_SIZE / 2 > p.x &&
        width / 2 - BIRD_SIZE / 2 < p.x + PIPE_WIDTH;

      if (hitX) {
        if (birdY < p.height || birdY > p.height + GAP) {
          return endGame();
        }
      }

      if (p.x + PIPE_WIDTH < width / 2 && !scoredPipes.current.has(p)) {
        scoredPipes.current.add(p);
        setScore(s => s + 1);
      }
    }

    if (birdY > height || birdY < 0) {
      endGame();
    }
  };

  // =========================
  // 🐤 FLAP
  // =========================
  const flap = () => {
    if (gameOver) return;

    setVelocity(JUMP);
    playSoundSafe(jumpSound);
  };

  // =========================
  // 💀 GAME OVER
  // =========================
  const endGame = async () => {
    if (gameOver) return;

    setGameOver(true);
    playSoundSafe(hitSound);

    if (score > highScore) {
      setHighScore(score);
      await AsyncStorage.setItem("highScore", String(score));
    }
  };

  // =========================
  // 🔁 TRY AGAIN
  // =========================
  const restart = () => {
    setBirdY(height / 2);
    setVelocity(0);
    setPipes([{ x: width, height: 180 }]);
    setScore(0);
    setGameOver(false);
    scoredPipes.current.clear();
  };

  return (
    <TouchableWithoutFeedback onPress={flap}>
      <View style={styles.container}>

        {/* Bird */}
        <Animated.View
          style={[
            styles.birdWrap,
            {
              top: birdY,
              transform: [
                {
                  rotate: tilt.interpolate({
                    inputRange: [-20, 20],
                    outputRange: ["-30deg", "30deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
            source={require("../assets/bird.png")}
            style={styles.bird}
          />
        </Animated.View>

        {/* Pipes */}
        {pipes.map((p, i) => (
          <View key={i}>
            <View style={[styles.pipe, { left: p.x, height: p.height }]} />
            <View
              style={[
                styles.pipe,
                { left: p.x, top: p.height + GAP, height: height },
              ]}
            />
          </View>
        ))}

        {/* UI */}
        <View style={styles.ui}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.high}>Best: {highScore}</Text>
        </View>

        {/* GAME OVER */}
        {gameOver && (
          <View style={styles.overlay}>
            <Text style={styles.title}>💀 Game Over</Text>
            <Text style={styles.sub}>Score: {score}</Text>

            <Pressable style={styles.button} onPress={restart}>
              <Text style={styles.buttonText}>Try Again</Text>
            </Pressable>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#74c0fc",
  },

  birdWrap: {
    position: "absolute",
    left: width / 2 - 21,
  },

  bird: {
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    resizeMode: "contain",
  },

  pipe: {
    position: "absolute",
    width: PIPE_WIDTH,
    backgroundColor: "#2ecc71",
    borderRadius: 8,
  },

  ui: {
    position: "absolute",
    top: 50,
    left: 20,
  },

  score: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#fff",
  },

  high: {
    fontSize: 16,
    color: "#fff",
    marginTop: 5,
  },

  overlay: {
    position: "absolute",
    width,
    height,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },

  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#fff",
  },

  sub: {
    fontSize: 20,
    color: "#fff",
    marginVertical: 10,
  },

  button: {
    marginTop: 20,
    backgroundColor: "#ff4757",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});