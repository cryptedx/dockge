<template>
    <div>
        <div v-if="valid">
            <ul v-if="isArrayInited" class="list-group">
                <li v-for="(value, index) in array" :key="index" class="list-group-item">
                    <input
                        v-model="array[index]"
                        type="text"
                        class="no-bg domain-input"
                        :name="`${name}-${index}`"
                        autocomplete="off"
                        :aria-label="`${displayName} ${index + 1}`"
                        :placeholder="placeholder"
                    />
                    <button class="action remove ms-2 me-3 text-danger" type="button" :aria-label="`Remove ${displayName} ${index + 1}`" @click="remove(index)">
                        <font-awesome-icon icon="times" />
                    </button>
                </li>
            </ul>

            <button class="btn btn-normal btn-sm mt-3" type="button" @click="addField">{{ $t("addListItem", [ displayName ]) }}</button>
        </div>
        <div v-else>
            {{ $t("LongSyntaxNotSupported") }}
        </div>
    </div>
</template>

<script>
export default {
    props: {
        name: {
            type: String,
            required: true,
        },
        placeholder: {
            type: String,
            default: "",
        },
        displayName: {
            type: String,
            required: true,
        },
        objectType: {
            type: String,
            default: "service",
        }
    },
    data() {
        return {

        };
    },
    computed: {
        array() {
            // Create the array if not exists, it should be safe.
            if (!this.service[this.name]) {
                return [];
            }
            return this.service[this.name];
        },

        /**
         * Check if the array is inited before called v-for.
         * Prevent empty arrays inserted to the YAML file.
         * @return {boolean}
         */
        isArrayInited() {
            return this.service[this.name] !== undefined;
        },

        /**
         * Not a good name, but it is used to get the object.
         */
        service() {
            if (this.objectType === "service") {
                // Used in Container.vue
                return this.$parent.$parent.service;
            } else if (this.objectType === "x-dockge") {

                if (!this.$parent.$parent.jsonConfig["x-dockge"]) {
                    return {};
                }

                // Used in Compose.vue
                return this.$parent.$parent.jsonConfig["x-dockge"];
            } else {
                return {};
            }
        },

        valid() {
            // Check if the array is actually an array
            if (!Array.isArray(this.array)) {
                return false;
            }

            // Check if the array contains non-object only.
            for (let item of this.array) {
                if (typeof item === "object") {
                    return false;
                }
            }
            return true;
        }

    },
    created() {

    },
    methods: {
        addField() {

            // Create the object if not exists.
            if (this.objectType === "x-dockge") {
                if (!this.$parent.$parent.jsonConfig["x-dockge"]) {
                    this.$parent.$parent.jsonConfig["x-dockge"] = {};
                }
            }

            // Create the array if not exists.
            if (!this.service[this.name]) {
                this.service[this.name] = [];
            }

            this.array.push("");
        },
        remove(index) {
            this.array.splice(index, 1);
        },
    }
};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.list-group {
    background-color: $dark-bg2;

    li {
        display: flex;
        align-items: center;
        padding: 10px 0 10px 10px;

        .domain-input {
            flex-grow: 1;
            background-color: $dark-bg2;
            border: none;
            color: $dark-font-color;

            &:focus-visible {
                outline: 2px solid rgba(116, 194, 255, 0.72);
                outline-offset: 2px;
            }

            &::placeholder {
                color: #1d2634;
            }
        }

        .remove {
            background: transparent;
            border: 0;
            padding: 0;
        }
    }
}
</style>
