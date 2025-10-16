import React from "react";
import { Switch, StyleSheet, View, Text } from "react-native";

interface Props {
    isTranslating : boolean;
    onToggle: () => void;
}

export const TranslationToggleButton: React.FC<Props> = ({ isTranslating, onToggle }) => {
    return(
        <View 
        style={style.container}>
            <Text 
            style={style.text}>Translate</Text>

            <Switch
            trackColor={{false: '#767577', true: '#81b0ff'}}
            thumbColor={isTranslating ? '#f5dd4b' : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
            onValueChange={onToggle}
            value={isTranslating}
            style={{ transform: [{ scaleX: 2 }, { scaleY: 2 }] }}
            />
        </View>
    );
}

const style = StyleSheet.create({
    container: {
        padding: 10,
        margin: 10,
        justifyContent: 'center',
        alignItems: 'center',
    }, 
    text: {
        textAlign: 'center',
        marginBottom: 10,
    },
});